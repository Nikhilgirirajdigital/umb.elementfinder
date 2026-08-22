using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Scoping;
using System.Text.Json;

namespace Umb.ElementFinder.Services;

/// <summary>
/// Element Type browsing uses Umbraco's live content type service directly; the list of pages
/// where an Element Type is used is resolved with a server-side paged SQL query against the
/// persisted property data, which keeps the dashboard responsive even on large content trees.
/// </summary>
public sealed class ElementFinderQueryService : IElementFinderQueryService
{
    private readonly IContentTypeService _contentTypeService;
    private readonly IScopeProvider _scopeProvider;

    public ElementFinderQueryService(
        IContentTypeService contentTypeService,
        IScopeProvider scopeProvider)
    {
        _contentTypeService = contentTypeService;
        _scopeProvider = scopeProvider;
    }

    public Task<PagedResult<ElementTypeSummary>> GetElementTypesAsync(
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var term = search?.Trim() ?? string.Empty;

        // Element Types are content types, not content nodes. Keeping the filtering and paging
        // on the server avoids sending the complete Element Type collection to the browser.
        // Element Type collections are normally small, so this uses the existing content type
        // service as the authoritative source and only materialises the requested page.
        var query = _contentTypeService.GetAll()
            .Where(t => t.IsElement);

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(t =>
                (t.Name ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase) ||
                t.Alias.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        var ordered = query
            .OrderBy(t => t.Name)
            .ThenBy(t => t.Alias);

        var totalItems = ordered.LongCount();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize));
        page = Math.Min(page, totalPages);

        var pageTypes = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        var usageCounts = scope.Database.Query<ElementTypeUsageCountRow>($"""
            SELECT usage.elementTypeKey AS ElementTypeKey, SUM(usage.usageCount) AS TotalUsageCount
            FROM {ElementUsageStore.UsageTable} usage
            INNER JOIN umbracoNode n ON n.id = usage.contentId
            WHERE n.trashed = 0
            GROUP BY usage.elementTypeKey
            """).ToDictionary(row => row.ElementTypeKey, row => row.TotalUsageCount);

        var items = pageTypes
            .Select(t => new ElementTypeSummary(
                t.Alias,
                t.Name ?? t.Alias,
                t.Icon,
                usageCounts.GetValueOrDefault(t.Key)))
            .ToList();

        return Task.FromResult(new PagedResult<ElementTypeSummary>(
            items, page, pageSize, totalItems, totalPages));
    }

    public Task<PagedResult<PageSummary>> GetPagesForElementTypeAsync(
        string elementTypeAlias,
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var elementType = _contentTypeService.Get(elementTypeAlias);
        if (elementType is null || !elementType.IsElement)
        {
            return Task.FromResult(new PagedResult<PageSummary>(
                Array.Empty<PageSummary>(), page, pageSize, 0, 1));
        }

        var result = GetPagesUsingElementType(elementType.Key, page, pageSize, search, ct);
        return Task.FromResult(result);
    }

    private PagedResult<PageSummary> GetPagesUsingElementType(
        Guid elementTypeKey,
        int page,
        int pageSize,
        string? search,
        CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        // Content-save notifications maintain this indexed mapping, so requests never scan
        // the large JSON values in umbracoPropertyData.
        var term = search?.Trim();

        const string baseSql = """
            SELECT
                n.id AS Id,
                n.uniqueId AS [Key],
                n.text AS Name,
                CASE WHEN EXISTS (
                    SELECT 1 FROM cmsContentNu published
                    WHERE published.nodeId = n.id AND published.published = 1
                ) THEN 1 ELSE 0 END AS Published,
                ct.icon AS Icon,
                usage.usageCount AS TotalUsagesCount,
                usage.usageCountsByCulture AS UsageCountsByCultureJson
            FROM umbElementFinderUsage usage
            INNER JOIN umbracoNode n ON n.id = usage.contentId
            INNER JOIN umbracoContent c ON c.nodeId = n.id
            INNER JOIN cmsContentType ct ON ct.nodeId = c.contentTypeId
            WHERE usage.elementTypeKey = @0
              AND n.trashed = 0
            """;

        using var scope = _scopeProvider.CreateScope(autoComplete: true);

        var sql = string.IsNullOrWhiteSpace(term)
            ? baseSql + " ORDER BY n.text "
            : baseSql + " AND n.text LIKE @1 ORDER BY n.text ";

        var pageResult = string.IsNullOrWhiteSpace(term)
            ? scope.Database.Page<ElementTypeUsageRow>(page, pageSize, sql, elementTypeKey)
            : scope.Database.Page<ElementTypeUsageRow>(page, pageSize, sql, elementTypeKey, $"%{term}%");

        var items = pageResult.Items
            .Select(row => new PageSummary(
                row.Id,
                row.Key,
                row.Name ?? "(unnamed)",
                row.Published,
                row.Icon,
                row.TotalUsagesCount,
                DeserializeCultureCounts(row.UsageCountsByCultureJson)))
            .ToList();

        return new PagedResult<PageSummary>(
            items,
            (int)pageResult.CurrentPage,
            (int)pageResult.ItemsPerPage,
            pageResult.TotalItems,
            (int)pageResult.TotalPages);
    }

    private sealed class ElementTypeUsageRow
    {
        public int Id { get; set; }
        public Guid Key { get; set; }
        public string? Name { get; set; }
        public bool Published { get; set; }
        public string? Icon { get; set; }
        public int TotalUsagesCount { get; set; }
        public string? UsageCountsByCultureJson { get; set; }
    }

    private static IReadOnlyDictionary<string, int> DeserializeCultureCounts(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, int>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, int>>(json)
                ?? new Dictionary<string, int>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, int>();
        }
    }

    private sealed class ElementTypeUsageCountRow
    {
        public Guid ElementTypeKey { get; set; }
        public long TotalUsageCount { get; set; }
    }
}
