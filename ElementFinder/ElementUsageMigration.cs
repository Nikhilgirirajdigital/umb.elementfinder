using Umbraco.Cms.Core.Packaging;
using Umbraco.Cms.Infrastructure.Migrations;

namespace Umb.ElementFinder.Services;

public sealed class ElementFinderMigrationPlan : PackageMigrationPlan
{
    public ElementFinderMigrationPlan() : base("Umb.ElementFinder") { }
    protected override void DefinePlan() => From(string.Empty)
        .To<CreateElementUsageTables>("element-usage-index-v1")
        .To<AddElementUsageCount>("element-usage-count-v2")
        .To<AddCultureUsageCounts>("element-culture-usage-count-v3");
}

public sealed class AddCultureUsageCounts : AsyncMigrationBase
{
    public AddCultureUsageCounts(IMigrationContext context) : base(context) { }

    protected override Task MigrateAsync()
    {
        if (!ColumnExists(ElementUsageStore.UsageTable, "usageCountsByCulture"))
        {
            Alter.Table(ElementUsageStore.UsageTable)
                .AddColumn("usageCountsByCulture")
                .AsString(4000)
                .NotNullable()
                .WithDefaultValue("{}")
                .Do();
        }

        Database.Execute($"DELETE FROM {ElementUsageStore.UsageTable}");
        Database.Execute($"UPDATE {ElementUsageStore.StateTable} SET initialized = @0 WHERE id = 1", false);
        return Task.CompletedTask;
    }
}

public sealed class AddElementUsageCount : AsyncMigrationBase
{
    public AddElementUsageCount(IMigrationContext context) : base(context) { }

    protected override Task MigrateAsync()
    {
        if (!ColumnExists(ElementUsageStore.UsageTable, "usageCount"))
        {
            Alter.Table(ElementUsageStore.UsageTable)
                .AddColumn("usageCount")
                .AsInt32()
                .NotNullable()
                .WithDefaultValue(1)
                .Do();
        }

        // Force the startup indexer to replace legacy page-only rows with occurrence counts.
        Database.Execute($"DELETE FROM {ElementUsageStore.UsageTable}");
        Database.Execute($"UPDATE {ElementUsageStore.StateTable} SET initialized = @0 WHERE id = 1", false);
        return Task.CompletedTask;
    }
}

public sealed class CreateElementUsageTables : AsyncMigrationBase
{
    public CreateElementUsageTables(IMigrationContext context) : base(context) { }
    protected override Task MigrateAsync()
    {
        if (!TableExists(ElementUsageStore.UsageTable))
        {
            Create.Table<ElementUsageRow>().Do();
            Create.Index("IX_umbElementFinderUsage_ContentId")
                .OnTable(ElementUsageStore.UsageTable)
                .OnColumn("contentId").Ascending()
                .Do();
        }
        if (!TableExists(ElementUsageStore.StateTable))
        {
            Create.Table<ElementUsageStateRow>().Do();
            Database.Insert(new ElementUsageStateRow { Id = 1, Initialized = false });
        }

        return Task.CompletedTask;
    }
}
