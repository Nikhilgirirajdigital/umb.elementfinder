using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umb.ContentCleaner.Models;
using Umb.ContentCleaner.Services;
using Umbraco.Cms.Core;
using Umbraco.Cms.Web.Common.Authorization;
using Xunit;

namespace Umb.ContentCleaner.Tests;

public class ContentCleanerApiControllerTests
{
    [Fact]
    public void ControllerUsesThePackageBackofficeRouteAndAuthenticationScheme()
    {
        var controllerType = typeof(ContentCleanerApiController);
        var route = Assert.Single(controllerType.GetCustomAttributes(typeof(RouteAttribute), true)
            .Cast<RouteAttribute>());
        var authorize = Assert.Single(controllerType.GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>());

        Assert.Equal("umbraco/backoffice/elementfinder/content-cleaner", route.Template);
        Assert.Equal(AuthorizationPolicies.SectionAccessSettings, authorize.Policy);
        Assert.Equal(Constants.Security.BackOfficeAuthenticationType, authorize.AuthenticationSchemes);
    }

    [Fact]
    public async Task CandidatesCombinesFiltersNumericSortingAndPagingOnCachedScan()
    {
        var scannedAt = DateTimeOffset.UtcNow;
        var candidates = new[]
        {
            Candidate("Alpha", "Property", 2, CleanupRisk.High),
            Candidate("Beta", "Property", 10, CleanupRisk.High),
            Candidate("Gamma", "Data Type", 20, CleanupRisk.High),
            Candidate("Delta", "Property", 1, CleanupRisk.Low)
        };
        var controller = new ContentCleanerApiController(new StubCacheService(
            new CleanerScanResponse(new CleanerSummary(4, 1, 0, 3, 0), candidates, scannedAt)));

        var response = await controller.Candidates(
            CancellationToken.None,
            skip: 0,
            take: 1,
            search: "a",
            type: "Property",
            risk: "High",
            sortBy: "usage",
            sortDirection: "desc");

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var page = Assert.IsType<CleanerPagedResponse<CleanupCandidate>>(ok.Value);
        Assert.Equal(2, page.Total);
        Assert.Single(page.Items);
        Assert.Equal("Beta", page.Items[0].Name);
        Assert.Equal(scannedAt, page.ScannedAtUtc);
    }

    private static CleanupCandidate Candidate(string name, string type, int usage, CleanupRisk risk)
        => new(Guid.NewGuid(), name, name.ToLowerInvariant(), type, usage, risk, string.Empty, [], []);

    private sealed class StubCacheService(CleanerScanResponse scan) : IContentCleanerCacheService
    {
        public Task<CleanerScanResponse> GetOrCreateAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(scan);

        public Task<CleanerScanResponse> RefreshAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(scan);
    }
}
