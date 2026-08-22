using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Infrastructure.Scoping;
using System.Text.Json;

namespace Umb.ElementFinder.Services;

internal sealed class ElementUsageIndexComponent : IAsyncComponent
{
    private readonly IScopeProvider _scopeProvider;
    public ElementUsageIndexComponent(IScopeProvider scopeProvider) => _scopeProvider = scopeProvider;

    public Task InitializeAsync(bool isRestarting, CancellationToken cancellationToken)
    {
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        if (scope.Database.ExecuteScalar<int>($"SELECT initialized FROM {ElementUsageStore.StateTable} WHERE id = 1") != 0)
            return Task.CompletedTask;

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
        var usages = new Dictionary<(Guid ElementTypeKey, int ContentId), Dictionary<string, int>>();
        foreach (var row in scope.Database.Query<PropertyValueRow>(sql))
        {
            cancellationToken.ThrowIfCancellationRequested();
            foreach (var (key, count) in ElementUsageExtractor.FromValues(row.TextValue, row.VarcharValue))
            {
                var usageKey = (key, row.ContentId);
                if (!usages.TryGetValue(usageKey, out var cultureCounts))
                    usages[usageKey] = cultureCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                var culture = string.IsNullOrWhiteSpace(row.Culture) ? "Invariant" : row.Culture;
                cultureCounts[culture] = cultureCounts.GetValueOrDefault(culture) + count;
            }
        }

        foreach (var (usage, cultureCounts) in usages)
            scope.Database.Insert(new ElementUsageRow
            {
                ElementTypeKey = usage.ElementTypeKey,
                ContentId = usage.ContentId,
                UsageCount = cultureCounts.Values.Sum(),
                UsageCountsByCulture = JsonSerializer.Serialize(cultureCounts)
            });
        scope.Database.Execute($"UPDATE {ElementUsageStore.StateTable} SET initialized = @0 WHERE id = 1", true);
        return Task.CompletedTask;
    }

    public Task TerminateAsync(bool isRestarting, CancellationToken cancellationToken) => Task.CompletedTask;
    private sealed class PropertyValueRow
    {
        public int ContentId { get; set; }
        public string? TextValue { get; set; }
        public string? VarcharValue { get; set; }
        public string? Culture { get; set; }
    }
}
