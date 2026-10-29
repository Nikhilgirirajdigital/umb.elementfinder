using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Umb.ContentCleaner.Services;

/// <summary>
/// Scans Data Types (Block List, Block Grid, Rich Text, etc.) and Content items,
/// safely removing block configurations and saved content block instances that reference
/// deleted Element Types or Document Types, preventing orphaned blocks, undefined errors,
/// and "Unsupported" block errors in the Umbraco backoffice.
/// </summary>
public sealed class BlockConfigurationCleanerService : IBlockConfigurationCleanerService
{
    private readonly IDataTypeService _dataTypeService;
    private readonly IContentService? _contentService;
    private readonly IContentTypeService? _contentTypeService;
    private readonly ILogger<BlockConfigurationCleanerService> _logger;

    [ActivatorUtilitiesConstructor]
    public BlockConfigurationCleanerService(
        IDataTypeService dataTypeService,
        IContentService contentService,
        IContentTypeService contentTypeService,
        ILogger<BlockConfigurationCleanerService> logger)
    {
        _dataTypeService = dataTypeService;
        _contentService = contentService;
        _contentTypeService = contentTypeService;
        _logger = logger;
    }

    public BlockConfigurationCleanerService(
        IDataTypeService dataTypeService,
        ILogger<BlockConfigurationCleanerService> logger)
        : this(dataTypeService, null!, null!, logger)
    {
    }

    public Task<int> RemoveBlockReferencesAsync(Guid elementOrContentTypeKey, CancellationToken cancellationToken = default)
        => RemoveBlockReferencesAsync(new HashSet<Guid> { elementOrContentTypeKey }, cancellationToken);

    public async Task<int> RemoveBlockReferencesAsync(IReadOnlySet<Guid> elementOrContentTypeKeys, CancellationToken cancellationToken = default)
    {
        if (elementOrContentTypeKeys is null || elementOrContentTypeKeys.Count == 0)
        {
            return 0;
        }

        var updatedCount = 0;

        // 1. Clean Data Types
        if (elementOrContentTypeKeys.Count > 0)
        {
            var dataTypes = (await _dataTypeService.GetAllAsync()).ToArray();

            foreach (var dataType in dataTypes)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (dataType.ConfigurationData is null || dataType.ConfigurationData.Count == 0)
                {
                    continue;
                }

                if (!TryCleanBlocks(dataType.ConfigurationData, elementOrContentTypeKeys, out var updatedConfig))
                {
                    continue;
                }

                try
                {
                    dataType.ConfigurationData = updatedConfig;
                    await _dataTypeService.UpdateAsync(dataType, Constants.Security.SuperUserKey);
                    updatedCount++;
                    _logger.LogInformation(
                        "Removed block configuration references to deleted items from Data Type '{DataTypeName}' ({DataTypeKey}).",
                        dataType.Name,
                        dataType.Key);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to update block configuration on Data Type '{DataTypeName}' ({DataTypeKey}) after item deletion.",
                        dataType.Name,
                        dataType.Key);
                }
            }
        }

        // 2. Clean saved block instances from Content property values
        if (_contentService is not null)
        {
            try
            {
                updatedCount += CleanContentBlockReferences(elementOrContentTypeKeys, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to clean content block references after item deletion.");
            }
        }

        return updatedCount;
    }

    private int CleanContentBlockReferences(
        IReadOnlySet<Guid> elementOrContentTypeKeys,
        CancellationToken cancellationToken)
    {
        if (_contentService is null)
        {
            return 0;
        }

        var cleanedContentCount = 0;
        var allContent = GetAllContentNodes();

        foreach (var content in allContent)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var contentModified = false;

                foreach (var property in content.Properties)
                {
                    foreach (var val in property.Values.ToArray())
                    {
                        var rawValue = val.EditedValue ?? val.PublishedValue;
                        if (rawValue is null)
                        {
                            continue;
                        }

                        string? json = rawValue switch
                        {
                            string s => s,
                            JsonElement je => je.GetRawText(),
                            JsonNode jn => jn.ToJsonString(),
                            _ => rawValue.ToString()
                        };

                        if (string.IsNullOrWhiteSpace(json) || !json.Contains("contentData", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        if (TryCleanContentBlockJson(json, elementOrContentTypeKeys, _contentTypeService, out var cleanedJson))
                        {
                            if (SetPropertyValueSafely(content, property, val.Culture, val.Segment, cleanedJson, _logger))
                            {
                                contentModified = true;
                            }
                        }
                    }
                }

                if (contentModified)
                {
                    try
                    {
                        _contentService.Save(content, -1);

                        if (IsContentPublished(content))
                        {
                            _contentService.Publish(content, ["*"], -1);
                        }

                        cleanedContentCount++;
                        _logger.LogInformation(
                            "Cleaned deleted block instances from content '{ContentName}' ({ContentKey}).",
                            content.Name,
                            content.Key);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(
                            ex,
                            "Failed to save cleaned content '{ContentName}' ({ContentKey}) after block cleanup.",
                            content.Name,
                            content.Key);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to process content '{ContentName}' ({ContentKey}) for block cleanup.",
                    content.Name,
                    content.Key);
            }
        }

        return cleanedContentCount;
    }

    private List<IContent> GetAllContentNodes()
    {
        if (_contentService is null)
        {
            return [];
        }

        var result = new List<IContent>();
        var rootNodes = _contentService.GetRootContent();
        var queue = new Queue<IContent>(rootNodes);

        while (queue.Count > 0)
        {
            var node = queue.Dequeue();
            result.Add(node);

            var page = 0;
            const int pageSize = 100;
            long total;
            do
            {
                var children = _contentService.GetPagedChildren(node.Id, page, pageSize, out total);
                foreach (var child in children)
                {
                    queue.Enqueue(child);
                }
                page++;
            } while (page * pageSize < total);
        }

        return result;
    }

    private static bool IsContentPublished(IContent content)
    {
        if (content is null)
        {
            return false;
        }

        // 1. Check PublishedState property dynamically (e.g. PublishedState.Published)
        try
        {
            var stateProp = content.GetType().GetProperty("PublishedState");
            if (stateProp is not null)
            {
                var state = stateProp.GetValue(content)?.ToString();
                if (string.Equals(state, "Published", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(state, "Publishing", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (string.Equals(state, "Unpublished", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(state, "Unpublishing", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }
        }
        catch
        {
            // Ignore and fall through
        }

        // 2. Check Published property dynamically (avoids static interface binding/MissingMethodException in v18+)
        try
        {
            var publishedProp = content.GetType().GetProperty("Published");
            if (publishedProp is not null && publishedProp.GetValue(content) is bool isPublished)
            {
                return isPublished;
            }
        }
        catch
        {
            // Ignore and fall through
        }

        // 3. Check PublishedCultures (for variant content)
        try
        {
            var culturesProp = content.GetType().GetProperty("PublishedCultures");
            if (culturesProp is not null && culturesProp.GetValue(content) is IEnumerable<string> cultures && cultures.Any())
            {
                return true;
            }
        }
        catch
        {
            // Ignore and fall through
        }

        return false;
    }

    private static bool SetPropertyValueSafely(
        IContent content,
        IProperty property,
        string? culture,
        string? segment,
        object? value,
        ILogger logger)
    {
        var targetCulture = culture;
        var targetSegment = segment;

        if (!PropertyVariesByCulture(property))
        {
            targetCulture = null;
        }

        if (!PropertyVariesBySegment(property))
        {
            targetSegment = null;
        }

        try
        {
            content.SetValue(property.Alias, value, targetCulture, targetSegment);
            return true;
        }
        catch (NotSupportedException)
        {
            // If the variation was rejected (e.g. legacy/orphaned variation data),
            // fallback to invariant SetValue
            try
            {
                content.SetValue(property.Alias, value);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Failed to set value for property '{PropertyAlias}' on content '{ContentName}' ({ContentKey}) with culture '{Culture}' and segment '{Segment}'.",
                    property.Alias,
                    content.Name,
                    content.Key,
                    culture,
                    segment);
                return false;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to set value for property '{PropertyAlias}' on content '{ContentName}' ({ContentKey}).",
                property.Alias,
                content.Name,
                content.Key);
            return false;
        }
    }

    private static bool PropertyVariesByCulture(IProperty property)
    {
        try
        {
            if (property.PropertyType is not null)
            {
                return property.PropertyType.VariesByCulture();
            }
        }
        catch
        {
            try
            {
                var variations = property.PropertyType?.Variations;
                if (variations.HasValue)
                {
                    return ((int)variations.Value & (int)ContentVariation.Culture) > 0;
                }
            }
            catch
            {
                // Ignore
            }
        }

        return false;
    }

    private static bool PropertyVariesBySegment(IProperty property)
    {
        try
        {
            if (property.PropertyType is not null)
            {
                return property.PropertyType.VariesBySegment();
            }
        }
        catch
        {
            try
            {
                var variations = property.PropertyType?.Variations;
                if (variations.HasValue)
                {
                    return ((int)variations.Value & (int)ContentVariation.Segment) > 0;
                }
            }
            catch
            {
                // Ignore
            }
        }

        return false;
    }

    public static bool TryCleanContentBlockJson(
        string jsonText,
        IReadOnlySet<Guid> keysToRemove,
        IContentTypeService? contentTypeService,
        out string cleanedJson)
    {
        cleanedJson = jsonText;
        if (string.IsNullOrWhiteSpace(jsonText))
        {
            return false;
        }

        var trimmed = jsonText.TrimStart();
        if (!trimmed.StartsWith('{'))
        {
            return false;
        }

        JsonNode? root;
        try
        {
            root = JsonNode.Parse(jsonText);
        }
        catch
        {
            return false;
        }

        if (root is not JsonObject rootObj)
        {
            return false;
        }

        var modified = false;

        if (rootObj.ContainsKey("contentData"))
        {
            if (CleanBlockContainer(rootObj, keysToRemove, contentTypeService))
            {
                modified = true;
            }
        }

        if (rootObj.TryGetPropertyValue("blocks", out var blocksNode) &&
            blocksNode is JsonObject blocksObj &&
            blocksObj.ContainsKey("contentData"))
        {
            if (CleanBlockContainer(blocksObj, keysToRemove, contentTypeService))
            {
                modified = true;
            }
        }

        if (modified)
        {
            cleanedJson = rootObj.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
        }

        return modified;
    }

    private static bool CleanBlockContainer(
        JsonObject container,
        IReadOnlySet<Guid> keysToRemove,
        IContentTypeService? contentTypeService)
    {
        var modified = false;

        var removedContentKeyGuids = new HashSet<Guid>();
        var removedContentKeyStrings = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var removedContentUdis = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var removedSettingsKeyGuids = new HashSet<Guid>();
        var removedSettingsKeyStrings = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var removedSettingsUdis = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // 1. Process contentData
        if (container.TryGetPropertyValue("contentData", out var cdNode) && cdNode is JsonArray cdArray)
        {
            var indicesToRemove = new List<int>();

            for (var i = 0; i < cdArray.Count; i++)
            {
                if (cdArray[i] is JsonObject blockObj)
                {
                    var removeBlock = false;

                    if (blockObj.TryGetPropertyValue("contentTypeKey", out var ctKeyNode) &&
                        TryGetGuid(ctKeyNode, out var ctGuid))
                    {
                        if (keysToRemove.Contains(ctGuid) ||
                            (contentTypeService is not null && contentTypeService.Get(ctGuid) is null))
                        {
                            removeBlock = true;
                        }
                    }

                    if (removeBlock)
                    {
                        indicesToRemove.Add(i);

                        if (blockObj.TryGetPropertyValue("key", out var keyNode))
                        {
                            if (TryGetGuid(keyNode, out var keyGuid))
                            {
                                removedContentKeyGuids.Add(keyGuid);
                                removedContentKeyStrings.Add(keyGuid.ToString());
                                removedContentUdis.Add("umb://element/" + keyGuid.ToString("N"));
                            }

                            var keyStr = keyNode?.ToString();
                            if (!string.IsNullOrWhiteSpace(keyStr))
                            {
                                removedContentKeyStrings.Add(keyStr);
                            }
                        }

                        if (blockObj.TryGetPropertyValue("udi", out var udiNode))
                        {
                            var udiStr = udiNode?.ToString();
                            if (!string.IsNullOrWhiteSpace(udiStr))
                            {
                                removedContentUdis.Add(udiStr);
                            }
                        }
                    }
                }
            }

            if (indicesToRemove.Count > 0)
            {
                for (var i = indicesToRemove.Count - 1; i >= 0; i--)
                {
                    cdArray.RemoveAt(indicesToRemove[i]);
                }
                modified = true;
            }
        }

        // 2. Process settingsData
        if (container.TryGetPropertyValue("settingsData", out var sdNode) && sdNode is JsonArray sdArray)
        {
            var settingsIndicesToRemove = new List<int>();

            for (var i = 0; i < sdArray.Count; i++)
            {
                if (sdArray[i] is JsonObject settingsObj)
                {
                    var removeSettings = false;

                    if (settingsObj.TryGetPropertyValue("contentTypeKey", out var sctKeyNode) &&
                        TryGetGuid(sctKeyNode, out var sctGuid))
                    {
                        if (keysToRemove.Contains(sctGuid) ||
                            (contentTypeService is not null && contentTypeService.Get(sctGuid) is null))
                        {
                            removeSettings = true;
                        }
                    }

                    if (removeSettings)
                    {
                        settingsIndicesToRemove.Add(i);

                        if (settingsObj.TryGetPropertyValue("key", out var skeyNode))
                        {
                            if (TryGetGuid(skeyNode, out var skeyGuid))
                            {
                                removedSettingsKeyGuids.Add(skeyGuid);
                                removedSettingsKeyStrings.Add(skeyGuid.ToString());
                                removedSettingsUdis.Add("umb://element/" + skeyGuid.ToString("N"));
                            }

                            var skeyStr = skeyNode?.ToString();
                            if (!string.IsNullOrWhiteSpace(skeyStr))
                            {
                                removedSettingsKeyStrings.Add(skeyStr);
                            }
                        }

                        if (settingsObj.TryGetPropertyValue("udi", out var sudiNode))
                        {
                            var sudiStr = sudiNode?.ToString();
                            if (!string.IsNullOrWhiteSpace(sudiStr))
                            {
                                removedSettingsUdis.Add(sudiStr);
                            }
                        }
                    }
                }
            }

            if (settingsIndicesToRemove.Count > 0)
            {
                for (var i = settingsIndicesToRemove.Count - 1; i >= 0; i--)
                {
                    sdArray.RemoveAt(settingsIndicesToRemove[i]);
                }
                modified = true;
            }
        }

        if (removedContentKeyGuids.Count == 0 &&
            removedContentKeyStrings.Count == 0 &&
            removedContentUdis.Count == 0 &&
            removedSettingsKeyGuids.Count == 0 &&
            removedSettingsKeyStrings.Count == 0 &&
            removedSettingsUdis.Count == 0)
        {
            return modified;
        }

        // 3. Process expose
        if (container.TryGetPropertyValue("expose", out var expNode) && expNode is JsonArray expArray)
        {
            var exposeIndicesToRemove = new List<int>();

            for (var i = 0; i < expArray.Count; i++)
            {
                if (expArray[i] is JsonObject expObj)
                {
                    if (expObj.TryGetPropertyValue("contentKey", out var cKeyNode))
                    {
                        if (TryGetGuid(cKeyNode, out var cKeyGuid) && removedContentKeyGuids.Contains(cKeyGuid))
                        {
                            exposeIndicesToRemove.Add(i);
                            continue;
                        }

                        var cKeyStr = cKeyNode?.ToString();
                        if (!string.IsNullOrWhiteSpace(cKeyStr) && removedContentKeyStrings.Contains(cKeyStr))
                        {
                            exposeIndicesToRemove.Add(i);
                            continue;
                        }
                    }
                }
            }

            if (exposeIndicesToRemove.Count > 0)
            {
                for (var i = exposeIndicesToRemove.Count - 1; i >= 0; i--)
                {
                    expArray.RemoveAt(exposeIndicesToRemove[i]);
                }
                modified = true;
            }
        }

        // 4. Process layout
        if (container.TryGetPropertyValue("layout", out var layoutNode) && layoutNode is JsonObject layoutObj)
        {
            foreach (var prop in layoutObj.ToArray())
            {
                if (prop.Value is JsonArray layoutArray)
                {
                    if (CleanContentLayoutArray(
                        layoutArray,
                        removedContentKeyGuids,
                        removedContentKeyStrings,
                        removedContentUdis,
                        removedSettingsKeyGuids,
                        removedSettingsKeyStrings,
                        removedSettingsUdis))
                    {
                        modified = true;
                    }
                }
            }
        }

        return modified;
    }

    private static bool CleanContentLayoutArray(
        JsonArray layoutArray,
        IReadOnlySet<Guid> removedContentKeyGuids,
        IReadOnlySet<string> removedContentKeyStrings,
        IReadOnlySet<string> removedContentUdis,
        IReadOnlySet<Guid> removedSettingsKeyGuids,
        IReadOnlySet<string> removedSettingsKeyStrings,
        IReadOnlySet<string> removedSettingsUdis)
    {
        var changed = false;
        var indicesToRemove = new List<int>();

        for (var i = 0; i < layoutArray.Count; i++)
        {
            if (layoutArray[i] is JsonObject blockLayout)
            {
                var remove = false;

                // Check contentKey
                if (blockLayout.TryGetPropertyValue("contentKey", out var ckNode))
                {
                    if (TryGetGuid(ckNode, out var ckGuid) && removedContentKeyGuids.Contains(ckGuid))
                    {
                        remove = true;
                    }
                    var ckStr = ckNode?.ToString();
                    if (!string.IsNullOrWhiteSpace(ckStr) && removedContentKeyStrings.Contains(ckStr))
                    {
                        remove = true;
                    }
                }

                // Check contentUdi
                if (!remove && blockLayout.TryGetPropertyValue("contentUdi", out var cuNode))
                {
                    var cuStr = cuNode?.ToString();
                    if (!string.IsNullOrWhiteSpace(cuStr) && removedContentUdis.Contains(cuStr))
                    {
                        remove = true;
                    }
                }

                if (remove)
                {
                    indicesToRemove.Add(i);
                    changed = true;
                    continue;
                }

                // If block remains, clear settings if its settings was removed
                if (blockLayout.TryGetPropertyValue("settingsKey", out var skNode))
                {
                    if ((TryGetGuid(skNode, out var skGuid) && removedSettingsKeyGuids.Contains(skGuid)) ||
                        (skNode?.ToString() is { } skStr && removedSettingsKeyStrings.Contains(skStr)))
                    {
                        blockLayout["settingsKey"] = null;
                        changed = true;
                    }
                }

                if (blockLayout.TryGetPropertyValue("settingsUdi", out var suNode))
                {
                    if (suNode?.ToString() is { } suStr && removedSettingsUdis.Contains(suStr))
                    {
                        blockLayout["settingsUdi"] = null;
                        changed = true;
                    }
                }

                // In Block Grid, check nested areas
                if (blockLayout.TryGetPropertyValue("areas", out var areasNode) && areasNode is JsonArray areasArray)
                {
                    foreach (var area in areasArray)
                    {
                        if (area is JsonObject areaObj &&
                            areaObj.TryGetPropertyValue("items", out var itemsNode) &&
                            itemsNode is JsonArray itemsArray)
                        {
                            if (CleanContentLayoutArray(
                                itemsArray,
                                removedContentKeyGuids,
                                removedContentKeyStrings,
                                removedContentUdis,
                                removedSettingsKeyGuids,
                                removedSettingsKeyStrings,
                                removedSettingsUdis))
                            {
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        if (indicesToRemove.Count > 0)
        {
            for (var i = indicesToRemove.Count - 1; i >= 0; i--)
            {
                layoutArray.RemoveAt(indicesToRemove[i]);
            }
        }

        return changed;
    }

    public static bool TryCleanBlocks(
        IDictionary<string, object?> configData,
        IReadOnlySet<Guid> keysToRemove,
        out Dictionary<string, object?> updatedConfig)
    {
        updatedConfig = new Dictionary<string, object?>(configData, StringComparer.OrdinalIgnoreCase);
        var modified = false;

        foreach (var key in configData.Keys)
        {
            var value = configData[key];
            if (value is null)
            {
                continue;
            }

            JsonNode? node = null;
            try
            {
                if (value is JsonNode jn)
                {
                    node = JsonNode.Parse(jn.ToJsonString());
                }
                else if (value is JsonElement je)
                {
                    node = JsonNode.Parse(je.GetRawText());
                }
                else if (value is string str && (str.TrimStart().StartsWith('[') || str.TrimStart().StartsWith('{')))
                {
                    node = JsonNode.Parse(str);
                }
                else
                {
                    var serialized = JsonSerializer.Serialize(value);
                    node = JsonNode.Parse(serialized);
                }
            }
            catch
            {
                continue;
            }

            if (node is null)
            {
                continue;
            }

            var propertyModified = false;

            if (node is JsonArray jsonArray)
            {
                propertyModified = CleanArray(jsonArray, keysToRemove);
            }
            else if (node is JsonObject jsonObject)
            {
                propertyModified = CleanObject(jsonObject, keysToRemove);
            }

            if (propertyModified)
            {
                modified = true;
                using var doc = JsonDocument.Parse(node.ToJsonString());
                updatedConfig[key] = doc.RootElement.Clone();
            }
        }

        return modified;
    }

    private static bool CleanArray(JsonArray array, IReadOnlySet<Guid> targetKeys)
    {
        var changed = false;
        var indicesToRemove = new List<int>();

        for (var i = 0; i < array.Count; i++)
        {
            var item = array[i];
            if (item is JsonObject obj)
            {
                // 1. Is this a block based on the deleted element type?
                var contentKeyProp = obj.FirstOrDefault(p =>
                    string.Equals(p.Key, "contentElementTypeKey", StringComparison.OrdinalIgnoreCase));

                if (contentKeyProp.Value is not null &&
                    TryGetGuid(contentKeyProp.Value, out var contentGuid) &&
                    targetKeys.Contains(contentGuid))
                {
                    indicesToRemove.Add(i);
                    changed = true;
                    continue;
                }

                // 2. Is this an area allowance referencing the deleted element type?
                var elemKeyProp = obj.FirstOrDefault(p =>
                    string.Equals(p.Key, "elementTypeKey", StringComparison.OrdinalIgnoreCase));

                if (elemKeyProp.Value is not null &&
                    TryGetGuid(elemKeyProp.Value, out var elemGuid) &&
                    targetKeys.Contains(elemGuid))
                {
                    indicesToRemove.Add(i);
                    changed = true;
                    continue;
                }

                // 3. Does this block reference the deleted element type as its settings?
                var settingsKeyProp = obj.FirstOrDefault(p =>
                    string.Equals(p.Key, "settingsElementTypeKey", StringComparison.OrdinalIgnoreCase));

                if (settingsKeyProp.Value is not null &&
                    TryGetGuid(settingsKeyProp.Value, out var settingsGuid) &&
                    targetKeys.Contains(settingsGuid))
                {
                    obj[settingsKeyProp.Key] = null;
                    changed = true;
                }

                // 4. Recursively clean nested properties (e.g. "areas", "specifiedAllowance")
                if (CleanObject(obj, targetKeys))
                {
                    changed = true;
                }
            }
            else if (item is JsonArray childArray)
            {
                if (CleanArray(childArray, targetKeys))
                {
                    changed = true;
                }
            }
        }

        for (var i = indicesToRemove.Count - 1; i >= 0; i--)
        {
            array.RemoveAt(indicesToRemove[i]);
        }

        return changed;
    }

    private static bool CleanObject(JsonObject obj, IReadOnlySet<Guid> targetKeys)
    {
        var changed = false;

        foreach (var prop in obj.ToArray())
        {
            if (prop.Value is JsonArray childArray)
            {
                if (CleanArray(childArray, targetKeys))
                {
                    changed = true;
                }
            }
            else if (prop.Value is JsonObject childObj)
            {
                if (CleanObject(childObj, targetKeys))
                {
                    changed = true;
                }
            }
        }

        return changed;
    }

    private static bool TryGetGuid(JsonNode? node, out Guid guid)
    {
        guid = Guid.Empty;
        if (node is null) return false;

        if (node is JsonValue jv)
        {
            if (jv.TryGetValue<Guid>(out guid))
            {
                return true;
            }

            if (jv.TryGetValue<string>(out var str) && Guid.TryParse(str, out guid))
            {
                return true;
            }
        }

        var text = node.ToString();
        return Guid.TryParse(text, out guid);
    }
}
