using NPoco;
using System.Text.Json;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Infrastructure.Scoping;

namespace Umb.ElementFinder.Services;

internal interface IElementUsageStore { void Replace(IContent content); }

internal sealed class ElementUsageStore : IElementUsageStore
{
    public const string UsageTable = "umbElementFinderUsage";
    public const string StateTable = "umbElementFinderState";
    private readonly IScopeProvider _scopeProvider;
    public ElementUsageStore(IScopeProvider scopeProvider) => _scopeProvider = scopeProvider;

    public void Replace(IContent content)
    {
        var usages = ElementUsageExtractor.FromContentByCulture(content);
        using var scope = _scopeProvider.CreateScope(autoComplete: true);
        scope.Database.Execute($"DELETE FROM {UsageTable} WHERE contentId = @0", content.Id);
        foreach (var (key, cultureCounts) in usages)
            scope.Database.Insert(new ElementUsageRow
            {
                ElementTypeKey = key,
                ContentId = content.Id,
                UsageCount = cultureCounts.Values.Sum(),
                UsageCountsByCulture = JsonSerializer.Serialize(cultureCounts)
            });
    }
}

[TableName(ElementUsageStore.UsageTable)]
[PrimaryKey("elementTypeKey,contentId", AutoIncrement = false)]
internal sealed class ElementUsageRow
{
    [Column("elementTypeKey")] public Guid ElementTypeKey { get; set; }
    [Column("contentId")] public int ContentId { get; set; }
    [Column("usageCount")] public int UsageCount { get; set; }
    [Column("usageCountsByCulture")] public string UsageCountsByCulture { get; set; } = "{}";
}

[TableName(ElementUsageStore.StateTable)]
[PrimaryKey("id", AutoIncrement = false)]
internal sealed class ElementUsageStateRow
{
    [Column("id")] public int Id { get; set; }
    [Column("initialized")] public bool Initialized { get; set; }
}
