using Umb.ElementFinder.Services;

namespace Umb.ElementFinder.Tests;

public sealed class ElementUsageExtractorTests
{
    private static readonly Guid ParentBlock = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid NestedBlock = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void FromValues_CountsBlocksNestedInsideABlock()
    {
        const string nested = """{"contentData":[{"contentTypeKey":"22222222-2222-2222-2222-222222222222","key":"b","values":[]},{"contentTypeKey":"22222222-2222-2222-2222-222222222222","key":"c","values":[]}],"settingsData":[],"expose":[],"layout":{}}""";
        const string outer = """{"contentData":[{"contentTypeKey":"11111111-1111-1111-1111-111111111111","key":"a","values":[{"editorAlias":"Umbraco.BlockList","culture":null,"segment":null,"alias":"items","value":"NESTED"}]}],"settingsData":[],"expose":[],"Layout":{}}""";

        // Umbraco 17 stores a Block List inside a block as a JSON string, with every quote as a u0022 unicode escape.
        var value = outer.Replace("NESTED", nested.Replace("\"", "\\u0022"));

        var counts = ElementUsageExtractor.FromValues(value);

        Assert.Equal(1, counts[ParentBlock]);
        Assert.Equal(2, counts[NestedBlock]);
    }

    [Theory]
    [InlineData("\"")]
    [InlineData("\\u0022")]
    [InlineData("\\\\u0022")]
    public void FromValues_CountsKeyAtAnyNestingDepth(string quote)
    {
        var value = $"{quote}contentTypeKey{quote}:{quote}22222222-2222-2222-2222-222222222222{quote}";

        var counts = ElementUsageExtractor.FromValues(value);

        Assert.Equal(1, counts.GetValueOrDefault(NestedBlock));
    }
}
