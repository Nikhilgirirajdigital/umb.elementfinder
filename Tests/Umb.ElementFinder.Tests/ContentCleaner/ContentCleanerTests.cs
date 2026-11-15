using Xunit;

namespace Umb.ContentCleaner.Tests;

public class ContentCleanerTests
{
    [Fact]
    public void PackageAssemblyCanBeLoaded()
    {
        var assembly = typeof(ContentCleanerComposer).Assembly;
        Assert.Equal("Umb.ElementFinder", assembly.GetName().Name);
    }
}
