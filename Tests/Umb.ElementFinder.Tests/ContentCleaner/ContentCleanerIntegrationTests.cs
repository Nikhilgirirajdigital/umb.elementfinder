using System.Text.Json;

namespace Umb.ContentCleaner.Tests;

public sealed class ContentCleanerIntegrationTests
{
    [Fact]
    public void PackageManifest_RegistersContentCleanerLastInAdvancedSettings()
    {
        var root = FindRepositoryRoot();
        var path = Path.Combine(root, "wwwroot", "App_Plugins", "ElementFinder", "umbraco-package.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));

        var extensions = document.RootElement.GetProperty("extensions").EnumerateArray().ToArray();
        var elementFinderDashboard = Assert.Single(extensions.Where(extension =>
            extension.GetProperty("alias").GetString() == "ElementFinder.Dashboard"));
        var menuItem = Assert.Single(extensions.Where(extension =>
            extension.GetProperty("alias").GetString() == "Umb.ContentCleaner.MenuItem"));

        Assert.Equal("Umb.Section.Content", elementFinderDashboard
            .GetProperty("conditions")[0]
            .GetProperty("match")
            .GetString());
        Assert.Equal("menuItem", menuItem.GetProperty("type").GetString());
        Assert.Equal(-10000, menuItem.GetProperty("weight").GetInt32());
        Assert.Contains("Umb.Menu.AdvancedSettings", menuItem
            .GetProperty("meta")
            .GetProperty("menus")
            .EnumerateArray()
            .Select(value => value.GetString()));
    }

    [Fact]
    public void DashboardBundleUsesTheContentCleanerBackofficeRoute()
    {
        var root = FindRepositoryRoot();
        var path = Path.Combine(root, "wwwroot", "App_Plugins", "ElementFinder", "content-cleaner-dashboard.element.js");
        var bundle = File.ReadAllText(path);

        Assert.Contains("/umbraco/backoffice/elementfinder/content-cleaner", bundle);
        Assert.DoesNotContain("/umbraco/management/api/v1/content-cleaner", bundle);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Umb.ElementFinder.csproj")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the repository root.");
    }
}
