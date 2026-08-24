using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Scoping;

namespace Umb.ElementFinder.Services;

/// <summary>
/// Element Type browsing uses Umbraco's live content type service directly; the list of pages
/// where an Element Type is used comes from an in-memory cache of the block JSON, with only the
/// display columns for the current page read from the database.
/// </summary>
public sealed class ElementFinderQueryService : IElementFinderQueryService
{
    private readonly IContentTypeService _contentTypeService;
    private readonly IScopeProvider _scopeProvider;
    private readonly IElementUsageCache _cache;

    public ElementFinderQueryService(
        IContentTypeService contentTypeService,
        IScopeProvider scopeProvider,
        IElementUsageCache cache)
    {
        _contentTypeService = contentTypeService;
        _scopeProvider = scopeProvider;
        _cache = cache;
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

        var usageCounts = _cache.GetTotals();

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

        // The in-memory cache knows which content ids use this Element Type and how often.
        // Only the presentation columns - name, published state, icon - come from the database,
        // and only for the ids that actually matched.
        var usages = _cache.GetUsages(elementTypeKey);
        if (usages.Count == 0)
            return new PagedResult<PageSummary>(Array.Empty<PageSummary>(), page, pageSize, 0, 1);

        var term = search?.Trim();

        // The ids come from our own cache and are integers, so inlining them avoids the
        // provider parameter limits a list this size would otherwise hit.
        var idList = string.Join(",", usages.Keys);

        var baseSql = $"""
            SELECT
                n.id AS Id,
                n.uniqueId AS [Key],
                n.text AS Name,
                CASE WHEN EXISTS (
                    SELECT 1 FROM cmsContentNu published
                    WHERE published.nodeId = n.id AND published.published = 1
                ) THEN 1 ELSE 0 END AS Published,
                ct.icon AS Icon
            FROM umbracoNode n
            INNER JOIN umbracoContent c ON c.nodeId = n.id
            INNER JOIN cmsContentType ct ON ct.nodeId = c.contentTypeId
            WHERE n.trashed = 0
              AND n.id IN ({idList})
            """;

        using var scope = _scopeProvider.CreateScope(autoComplete: true);

        var sql = string.IsNullOrWhiteSpace(term)
            ? baseSql + " ORDER BY n.text "
            : baseSql + " AND n.text LIKE @0 ORDER BY n.text ";

        var pageResult = string.IsNullOrWhiteSpace(term)
            ? scope.Database.Page<ElementTypeUsageRow>(page, pageSize, sql)
            : scope.Database.Page<ElementTypeUsageRow>(page, pageSize, sql, $"%{term}%");

        var items = pageResult.Items
            .Select(row =>
            {
                var cultureCounts = usages.TryGetValue(row.Id, out var counts)
                    ? counts
                    : new Dictionary<string, int>();

                return new PageSummary(
                    row.Id,
                    row.Key,
                    row.Name ?? "(unnamed)",
                    row.Published,
                    row.Icon,
                    cultureCounts.Values.Sum(),
                    cultureCounts);
            })
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
    }

}
