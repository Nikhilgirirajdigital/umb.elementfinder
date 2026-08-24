using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Infrastructure.Scoping;

namespace Umb.ElementFinder.Services;

public interface IElementUsageCache
{
    /// <summary>Total occurrences per Element Type, across all content.</summary>
    IReadOnlyDictionary<Guid, long> GetTotals();

    /// <summary>Content id to per-culture occurrence counts, for one Element Type.</summary>
    IReadOnlyDictionary<int, IReadOnlyDictionary<string, int>> GetUsages(Guid elementTypeKey);

    /// <summary>Re-reads one content item into an already-built index.</summary>
    void Update(IContent content);

    /// <summary>Drops the index so the next read rebuilds it from the database.</summary>
    void Invalidate();
}

/// <summary>
/// Element Type usage lives inside the JSON that Block List, Block Grid and Nested Content
/// write into umbracoPropertyData, so there is no relational way to ask which pages use a
/// given Element Type. This scans that JSON once and keeps the result in memory.
///
/// The scan is deliberately lazy: a site where nobody opens the dashboard never pays for it.
/// Content saves patch the index in place, and anything that can change which content exists
/// (trash, delete, move) drops it so the next read rebuilds from current data.
/// </summary>
internal sealed class ElementUsageCache : IElementUsageCache
{
    private readonly IScopeProvider _scopeProvider;
    private readonly Lock _gate = new();

    /// <summary>Element Type key -> content id -> culture -> occurrences.</summary>
    private Dictionary<Guid, Dictionary<int, Dictionary<string, int>>>? _cache;

    public ElementUsageCache(IScopeProvider scopeProvider) => _scopeProvider = scopeProvider;

    public IReadOnlyDictionary<Guid, long> GetTotals()
    {
        lock (_gate)
        {
            return Build().ToDictionary(
                entry => entry.Key,
                entry => entry.Value.Values.Sum(cultures => (long)cultures.Values.Sum()));
        }
    }

    public IReadOnlyDictionary<int, IReadOnlyDictionary<string, int>> GetUsages(Guid elementTypeKey)
    {
        lock (_gate)
        {
            if (!Build().TryGetValue(elementTypeKey, out var usages))
                return new Dictionary<int, IReadOnlyDictionary<string, int>>();

            return usages.ToDictionary(
                usage => usage.Key,
                usage => (IReadOnlyDictionary<string, int>)new Dictionary<string, int>(usage.Value));
        }
    }

    public void Update(IContent content)
    {
        lock (_gate)
        {
            // Nothing built yet means nothing to patch - the next read scans current data anyway.
            if (_cache is null) return;

            foreach (var usages in _cache.Values) usages.Remove(content.Id);

            foreach (var (elementTypeKey, cultureCounts) in ElementUsageExtractor.FromContentByCulture(content))
            {
                if (!_cache.TryGetValue(elementTypeKey, out var byContent))
                    _cache[elementTypeKey] = byContent = new Dictionary<int, Dictionary<string, int>>();

                byContent[content.Id] = new Dictionary<string, int>(cultureCounts, StringComparer.OrdinalIgnoreCase);
            }
        }
    }

    public void Invalidate()
    {
        lock (_gate)
        {
            _cache = null;
        }
    }

    private Dictionary<Guid, Dictionary<int, Dictionary<string, int>>> Build()
    {
        if (_cache is not null) return _cache;

        const string sql = """
            SELECT cv.nodeId AS ContentId, pd.textValue AS TextValue, pd.varcharValue AS VarcharValue,
                   lang.languageISOCode AS Culture
            FROM umbracoPropertyData pd
            INNER JOIN umbracoContentVersion cv ON cv.id = pd.versionId
            INNER JOIN umbracoNode n ON n.id = cv.nodeId
            LEFT JOIN umbracoLanguage lang ON lang.id = pd.languageId
            WHERE cv.[current] = 1 AND n.trashed = 0
              AND (pd.textValue IS NOT NULL OR pd.varcharValue IS NOT NULL)
            """;

        var index = new Dictionary<Guid, Dictionary<int, Dictionary<string, int>>>();

        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        foreach (var row in scope.Database.Query<PropertyValueRow>(sql))
        {
            var culture = string.IsNullOrWhiteSpace(row.Culture) ? "Invariant" : row.Culture;
            foreach (var (elementTypeKey, count) in ElementUsageExtractor.FromValues(row.TextValue, row.VarcharValue))
            {
                if (!index.TryGetValue(elementTypeKey, out var byContent))
                    index[elementTypeKey] = byContent = new Dictionary<int, Dictionary<string, int>>();

                if (!byContent.TryGetValue(row.ContentId, out var cultureCounts))
                    byContent[row.ContentId] = cultureCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                cultureCounts[culture] = cultureCounts.GetValueOrDefault(culture) + count;
            }
        }

        return _cache = index;
    }

    private sealed class PropertyValueRow
    {
        public int ContentId { get; set; }
        public string? TextValue { get; set; }
        public string? VarcharValue { get; set; }
        public string? Culture { get; set; }
    }
}
