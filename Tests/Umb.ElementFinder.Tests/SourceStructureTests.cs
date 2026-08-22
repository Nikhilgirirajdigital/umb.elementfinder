using System.Text.Json;

namespace Umb.ElementFinder.Tests;

public sealed class SourceStructureTests
{
    [Fact]
    public void PackageManifest_UsesElementFinderNames()
    {
        var root = FindRepositoryRoot();
        var path = Path.Combine(root, "wwwroot", "App_Plugins", "ElementFinder", "umbraco-package.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));

        Assert.Equal("Element Finder", document.RootElement.GetProperty("name").GetString());
        Assert.Equal("17.0.0", document.RootElement.GetProperty("version").GetString());
    }

    private static string FindRepositoryRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Umb.ElementFinder.csproj")))
                return dir.FullName;
            dir = dir.Parent!;
        }
        throw new DirectoryNotFoundException("Could not locate the repository root.");
    }
}
