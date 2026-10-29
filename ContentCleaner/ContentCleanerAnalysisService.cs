using System.Text.Json;
using System.Text.RegularExpressions;
using Umb.ContentCleaner.Models;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Umb.ContentCleaner.Services;

/// <summary>
/// Read-only analyzer for Umbraco content-model cleanup candidates.
/// V1 never deletes or mutates content-model configuration.
/// </summary>
public sealed class ContentCleanerAnalysisService : IContentCleanerAnalysisService
{
    private const int ContentScanPageSize = 250;

    private static readonly Regex GuidRegex = new(
        @"(?<![0-9a-fA-F])[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![0-9a-fA-F])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly IContentTypeService _contentTypeService;
    private readonly IContentService _contentService;
    private readonly IDataTypeService _dataTypeService;

    public ContentCleanerAnalysisService(
        IContentTypeService contentTypeService,
        IContentService contentService,
        IDataTypeService dataTypeService)
    {
        _contentTypeService = contentTypeService;
        _contentService = contentService;
        _dataTypeService = dataTypeService;
    }

    public async Task<CleanerScanResponse> ScanAsync(CancellationToken cancellationToken = default)
    {
        var contentTypes = _contentTypeService.GetAll().ToArray();
        var dataTypes = (await _dataTypeService.GetAllAsync()).ToArray();
        var dataTypesById = dataTypes.ToDictionary(x => x.Id);
        var propertyReferencesByDataType = BuildPropertyReferenceIndex(contentTypes);
        var usageIndexes = BuildUsageIndexes(contentTypes, dataTypes, dataTypesById, cancellationToken);
        var items = new List<CleanupCandidate>();

        foreach (var contentType in contentTypes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            items.Add(AnalyzeContentType(contentType, contentTypes, usageIndexes));

            foreach (var propertyType in contentType.PropertyTypes)
            {
                cancellationToken.ThrowIfCancellationRequested();
                items.Add(AnalyzeProperty(contentType, propertyType, dataTypesById, usageIndexes));
            }
        }

        foreach (var dataType in dataTypes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            propertyReferencesByDataType.TryGetValue(dataType.Id, out var propertyReferences);
            items.Add(AnalyzeDataType(dataType, propertyReferences ?? []));
        }

        var ordered = items
            .OrderBy(x => RiskSort(x.Risk))
            .ThenBy(x => x.Type)
            .ThenBy(x => x.Name)
            .ToArray();

        var summary = new CleanerSummary(
            ordered.Length,
            ordered.Count(x => x.Risk == CleanupRisk.Low),
            ordered.Count(x => x.Risk == CleanupRisk.Moderate),
            ordered.Count(x => x.Risk == CleanupRisk.Review),
            ordered.Count(x => x.Risk == CleanupRisk.High));

        return new CleanerScanResponse(summary, ordered, DateTimeOffset.UtcNow);
    }

    private static Dictionary<int, List<PropertyDefinitionReference>> BuildPropertyReferenceIndex(
        IReadOnlyCollection<IContentType> contentTypes)
    {
        var index = new Dictionary<int, List<PropertyDefinitionReference>>();

        foreach (var contentType in contentTypes)
        {
            foreach (var propertyType in contentType.PropertyTypes)
            {
                if (!index.TryGetValue(propertyType.DataTypeId, out var references))
                {
                    references = [];
                    index[propertyType.DataTypeId] = references;
                }

                references.Add(new PropertyDefinitionReference(contentType, propertyType));
            }
        }

        return index;
    }

    private UsageIndexes BuildUsageIndexes(
        IReadOnlyCollection<IContentType> contentTypes,
        IReadOnlyCollection<IDataType> dataTypes,
        IReadOnlyDictionary<int, IDataType> dataTypesById,
        CancellationToken cancellationToken)
    {
        var elementTypeKeys = contentTypes
            .Where(x => x.IsElement)
            .Select(x => x.Key)
            .ToHashSet();

        var elementUsage = elementTypeKeys.ToDictionary(x => x, _ => new ElementUsageInfo());
        var contentTypeUsage = contentTypes
            .Where(x => !x.IsElement)
            .ToDictionary(x => x.Id, _ => new ContentTypeUsageInfo());

        // Block List/Grid Data Type configurations contain allowed Element Type keys even
        // when no saved block instance exists. ConfigurationData is available in v17/v18.
        foreach (var dataType in dataTypes)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var matchingKeys = new HashSet<Guid>();
            ExtractMatchingElementKeys(dataType.ConfigurationData, elementTypeKeys, matchingKeys);

            foreach (var key in matchingKeys)
            {
                elementUsage[key].ConfigurationUsages[dataType.Key] = new UsageReference(
                    dataType.Key,
                    DataTypeName(dataType),
                    UsageReferenceType.DataType,
                    null,
                    DataTypeName(dataType),
                    dataType.Key,
                    null);
            }
        }

        // Each Document Type is paged only once. The same pass builds direct content usage,
        // property saved-value usage, and Element Type usage from serialized editor values.
        foreach (var hostContentType in contentTypes.Where(x => !x.IsElement))
        {
            var usage = contentTypeUsage[hostContentType.Id];
            var propertyTypesByAlias = hostContentType.PropertyTypes
                .GroupBy(x => x.Alias, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            long totalRecords;
            long pageIndex = 0;

            do
            {
                cancellationToken.ThrowIfCancellationRequested();

                var contentItems = _contentService
                    .GetPagedOfType(hostContentType.Id, pageIndex, ContentScanPageSize, out totalRecords, default!)
                    .ToArray();

                foreach (var content in contentItems)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var contentName = content.Name ?? content.Key.ToString();
                    usage.ContentUsages.Add(new UsageReference(
                        content.Key,
                        contentName,
                        UsageReferenceType.Content,
                        null,
                        null,
                        null,
                        hostContentType.Alias));

                    var elementKeysUsedByContent = new Dictionary<Guid, UsageReference>();

                    foreach (var property in content.Properties)
                    {
                        propertyTypesByAlias.TryGetValue(property.Alias, out var propertyType);
                        dataTypesById.TryGetValue(propertyType?.DataTypeId ?? 0, out var dataType);

                        if (propertyType is not null && property.Values.Any(value =>
                                HasValue(value.EditedValue) || HasValue(value.PublishedValue)))
                        {
                            if (!usage.PropertyUsages.TryGetValue(propertyType.Key, out var propertyUsages))
                            {
                                propertyUsages = [];
                                usage.PropertyUsages[propertyType.Key] = propertyUsages;
                            }

                            propertyUsages.Add(new UsageReference(
                                content.Key,
                                contentName,
                                UsageReferenceType.Content,
                                property.Alias,
                                dataType is null ? null : DataTypeName(dataType),
                                dataType?.Key,
                                hostContentType.Alias));
                        }

                        if (elementTypeKeys.Count == 0)
                        {
                            continue;
                        }

                        var matchingKeys = new HashSet<Guid>();
                        foreach (var value in property.Values)
                        {
                            ExtractMatchingElementKeys(value.EditedValue, elementTypeKeys, matchingKeys);
                            ExtractMatchingElementKeys(value.PublishedValue, elementTypeKeys, matchingKeys);
                        }

                        foreach (var key in matchingKeys)
                        {
                            // Preserve the existing count semantics: an Element Type is counted
                            // once per host content item, even if it occurs in multiple properties.
                            elementKeysUsedByContent.TryAdd(key, new UsageReference(
                                content.Key,
                                contentName,
                                BlockReferenceType(dataType),
                                property.Alias,
                                dataType is null ? null : DataTypeName(dataType),
                                dataType?.Key,
                                hostContentType.Alias));
                        }
                    }

                    foreach (var (key, reference) in elementKeysUsedByContent)
                    {
                        elementUsage[key].ContentUsages[content.Key] = reference;
                    }
                }

                pageIndex++;
            }
            while (pageIndex * ContentScanPageSize < totalRecords);
        }

        return new UsageIndexes(contentTypeUsage, elementUsage);
    }

    private static CleanupCandidate AnalyzeContentType(
        IContentType contentType,
        IReadOnlyCollection<IContentType> allContentTypes,
        UsageIndexes usageIndexes)
    {
        // IMPORTANT for Umbraco 17/18: keep composition detection on
        // ContentTypeComposition; IPropertyType does not expose ContentTypeId.
        var compositionConsumers = allContentTypes
            .Where(x => x.Id != contentType.Id)
            .Where(x => x.ContentTypeComposition.Any(composition =>
                composition.Id == contentType.Id))
            .ToArray();

        var compositionUsages = compositionConsumers
            .Select(x => new UsageReference(
                x.Key,
                ContentTypeName(x),
                UsageReferenceType.Composition,
                null,
                null,
                null,
                x.Alias))
            .ToArray();

        if (contentType.IsElement)
        {
            usageIndexes.ElementTypes.TryGetValue(contentType.Key, out var elementUsage);
            elementUsage ??= new ElementUsageInfo();

            var usages = elementUsage.ContentUsages.Values
                .Concat(elementUsage.ConfigurationUsages.Values)
                .Concat(compositionUsages)
                .OrderBy(x => x.ReferenceType)
                .ThenBy(x => x.Name)
                .ToArray();

            var contentUsageCount = elementUsage.ContentUsages.Count;
            var configurationUsageCount = elementUsage.ConfigurationUsages.Count + compositionConsumers.Length;
            var usageCount = contentUsageCount + configurationUsageCount;
            var risk = contentUsageCount > 0
                ? CleanupRisk.High
                : configurationUsageCount > 0
                    ? CleanupRisk.Review
                    : CleanupRisk.Low;

            var summary = risk switch
            {
                CleanupRisk.High => $"Used in {contentUsageCount} content item(s) through Block List/Grid or another serialized editor value.",
                CleanupRisk.Review => "No saved block instances were found, but structural or Block editor configuration references exist.",
                _ => "No saved Document Type instances, Block editor configuration references, or composition consumers were detected."
            };

            return Candidate(contentType.Key, ContentTypeName(contentType), contentType.Alias,
                "Document Type", usageCount, risk, summary, usages);
        }

        usageIndexes.ContentTypes.TryGetValue(contentType.Id, out var contentUsage);
        var contentUsages = contentUsage?.ContentUsages ?? [];
        var allUsages = contentUsages.Concat(compositionUsages).ToArray();
        var contentUsageCountForType = contentUsages.Count;
        var configurationUsageCountForType = compositionConsumers.Length;
        var usageCountForType = contentUsageCountForType + configurationUsageCountForType;
        var documentRisk = contentUsageCountForType > 0
            ? CleanupRisk.High
            : configurationUsageCountForType > 0 ? CleanupRisk.Review : CleanupRisk.Low;

        var documentSummary = documentRisk switch
        {
            CleanupRisk.Low => "No content instances or composition consumers were detected.",
            CleanupRisk.Review => "No direct content instances were found, but structural dependencies exist.",
            _ => $"Used by {contentUsageCountForType} content item(s)."
        };

        return Candidate(contentType.Key, ContentTypeName(contentType), contentType.Alias,
            "Document Type", usageCountForType, documentRisk, documentSummary, allUsages);
    }

    private static CleanupCandidate AnalyzeProperty(
        IContentType contentType,
        IPropertyType propertyType,
        IReadOnlyDictionary<int, IDataType> dataTypesById,
        UsageIndexes usageIndexes)
    {
        dataTypesById.TryGetValue(propertyType.DataTypeId, out var dataType);
        var definitionUsage = new UsageReference(
            contentType.Key,
            ContentTypeName(contentType),
            UsageReferenceType.DocumentType,
            propertyType.Alias,
            dataType is null ? null : DataTypeName(dataType),
            dataType?.Key,
            contentType.Alias);

        if (contentType.IsElement)
        {
            var elementPropertyUsages = new[] { definitionUsage };
            return Candidate(propertyType.Key, propertyType.Name ?? propertyType.Alias, propertyType.Alias,
                "Property", elementPropertyUsages.Length, CleanupRisk.Moderate,
                "Property belongs to a Document Type. Its values are embedded in Block List/Grid data and are not counted independently in this version.",
                elementPropertyUsages);
        }

        usageIndexes.ContentTypes.TryGetValue(contentType.Id, out var contentUsage);
        var savedValueUsages = new List<UsageReference>();
        if (contentUsage is not null)
        {
            contentUsage.PropertyUsages.TryGetValue(propertyType.Key, out savedValueUsages);
            savedValueUsages ??= [];
        }

        var usages = savedValueUsages.Append(definitionUsage).ToArray();
        var usageCount = usages.Length;
        var hasSavedValues = savedValueUsages.Count > 0;

        return Candidate(propertyType.Key, propertyType.Name ?? propertyType.Alias, propertyType.Alias,
            "Property", usageCount, hasSavedValues ? CleanupRisk.High : CleanupRisk.Review,
            hasSavedValues
                ? $"Saved values exist on {savedValueUsages.Count} content item(s)."
                : "No saved values were detected. Review custom code and editor configuration before removal.",
            usages);
    }

    private static CleanupCandidate AnalyzeDataType(
        IDataType dataType,
        IReadOnlyCollection<PropertyDefinitionReference> propertyReferences)
    {
        var usages = propertyReferences
            .Select(x => new UsageReference(
                x.ContentType.Key,
                ContentTypeName(x.ContentType),
                UsageReferenceType.DocumentType,
                x.PropertyType.Alias,
                DataTypeName(dataType),
                dataType.Key,
                x.ContentType.Alias))
            .OrderBy(x => x.Name)
            .ThenBy(x => x.PropertyAlias)
            .ToArray();

        var risk = usages.Length == 0 ? CleanupRisk.Low : CleanupRisk.High;
        var summary = usages.Length == 0
            ? "No properties reference this Data Type."
            : $"Referenced by {usages.Length} propert{(usages.Length == 1 ? "y" : "ies")}.";

        return Candidate(dataType.Key, DataTypeName(dataType), dataType.EditorAlias,
            "Data Type", usages.Length, risk, summary, usages);
    }

    private static CleanupCandidate Candidate(
        Guid key,
        string name,
        string alias,
        string type,
        int usageCount,
        CleanupRisk risk,
        string summary,
        IReadOnlyCollection<UsageReference> usages)
    {
        var dependencies = usages.Take(10).Select(LegacyDependencyText).ToList();
        if (usages.Count > 10)
        {
            dependencies.Add($"+ {usages.Count - 10} more");
        }

        return new CleanupCandidate(key, name, alias, type, usageCount, risk, summary, dependencies, usages);
    }

    private static string LegacyDependencyText(UsageReference usage) => usage.ReferenceType switch
    {
        UsageReferenceType.DataType => $"Configured in Data Type: {usage.Name}",
        UsageReferenceType.Composition => $"Composition: {usage.Name}",
        UsageReferenceType.DocumentType or UsageReferenceType.ElementType when usage.PropertyAlias is not null
            => $"{usage.ContentTypeAlias}.{usage.PropertyAlias}",
        _ => $"Used in content: {usage.Name}"
    };

    private static void ExtractMatchingElementKeys(
        object? value,
        IReadOnlySet<Guid> elementTypeKeys,
        ISet<Guid> matches)
    {
        if (value is null)
        {
            return;
        }

        string? text = value switch
        {
            string stringValue => stringValue,
            JsonElement jsonElement => jsonElement.GetRawText(),
            JsonDocument jsonDocument => jsonDocument.RootElement.GetRawText(),
            _ => TrySerialize(value)
        };

        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        foreach (Match match in GuidRegex.Matches(text))
        {
            if (Guid.TryParse(match.Value, out var key) && elementTypeKeys.Contains(key))
            {
                matches.Add(key);
            }
        }
    }

    private static string? TrySerialize(object value)
    {
        try
        {
            return JsonSerializer.Serialize(value);
        }
        catch
        {
            return value.ToString();
        }
    }

    private static bool HasValue(object? value)
    {
        if (value is null)
        {
            return false;
        }

        return value is not string stringValue || !string.IsNullOrWhiteSpace(stringValue);
    }

    private static UsageReferenceType BlockReferenceType(IDataType? dataType)
    {
        var alias = $"{dataType?.EditorAlias} {dataType?.EditorUiAlias}";
        if (alias.Contains("BlockGrid", StringComparison.OrdinalIgnoreCase))
        {
            return UsageReferenceType.BlockGrid;
        }

        return alias.Contains("BlockList", StringComparison.OrdinalIgnoreCase)
            ? UsageReferenceType.BlockList
            : UsageReferenceType.Content;
    }

    private static string ContentTypeName(IContentType contentType)
        => contentType.Name ?? contentType.Alias;

    private static string DataTypeName(IDataType dataType)
        => dataType.Name ?? dataType.EditorAlias;

    private static int RiskSort(CleanupRisk risk) => risk switch
    {
        CleanupRisk.Low => 0,
        CleanupRisk.Moderate => 1,
        CleanupRisk.Review => 2,
        CleanupRisk.High => 3,
        _ => 4
    };

    private sealed record PropertyDefinitionReference(IContentType ContentType, IPropertyType PropertyType);

    private sealed record UsageIndexes(
        IReadOnlyDictionary<int, ContentTypeUsageInfo> ContentTypes,
        IReadOnlyDictionary<Guid, ElementUsageInfo> ElementTypes);

    private sealed class ContentTypeUsageInfo
    {
        public List<UsageReference> ContentUsages { get; } = [];

        public Dictionary<Guid, List<UsageReference>> PropertyUsages { get; } = [];
    }

    private sealed class ElementUsageInfo
    {
        public Dictionary<Guid, UsageReference> ContentUsages { get; } = [];

        public Dictionary<Guid, UsageReference> ConfigurationUsages { get; } = [];
    }
}
