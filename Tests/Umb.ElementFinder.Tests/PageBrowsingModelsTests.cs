using Umb.ElementFinder.Services;

namespace Umb.ElementFinder.Tests;

public sealed class PageBrowsingModelsTests
{
    [Fact]
    public void ElementTypeSummary_StoresExpectedValues()
    {
        var item = new ElementTypeSummary("richText", "Rich Text", "icon-doc-richtext", 12);

        Assert.Equal("richText", item.Alias);
        Assert.Equal("Rich Text", item.Name);
        Assert.Equal("icon-doc-richtext", item.Icon);
        Assert.Equal(12, item.TotalUsageCount);
    }

    [Fact]
    public void PagedResult_StoresPaginationMetadata()
    {
        var result = new PagedResult<string>(["one", "two"], 2, 20, 42, 3);

        Assert.Equal(2, result.Page);
        Assert.Equal(20, result.PageSize);
        Assert.Equal(42, result.TotalItems);
        Assert.Equal(3, result.TotalPages);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public void PageSummary_StoresPerPageUsageCount()
    {
        var key = Guid.NewGuid();
        var item = new PageSummary(42, key, "Home", true, "icon-home", 7,
            new Dictionary<string, int> { ["en-US"] = 4, ["ar-AE"] = 3 });

        Assert.Equal(42, item.Id);
        Assert.Equal(key, item.Key);
        Assert.Equal("Home", item.Name);
        Assert.True(item.Published);
        Assert.Equal("icon-home", item.Icon);
        Assert.Equal(7, item.TotalUsagesCount);
        Assert.Equal(4, item.UsageCountsByCulture["en-US"]);
        Assert.Equal(3, item.UsageCountsByCulture["ar-AE"]);
    }
}
