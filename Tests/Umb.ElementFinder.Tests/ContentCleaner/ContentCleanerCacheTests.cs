using Microsoft.Extensions.Caching.Memory;
using Umb.ContentCleaner.Models;
using Umb.ContentCleaner.Services;
using Xunit;

namespace Umb.ContentCleaner.Tests;

public class ContentCleanerCacheTests
{
    [Fact]
    public async Task CachedReadsReuseScanAndRefreshForcesNewScan()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var analysis = new CountingAnalysisService();
        var cache = new ContentCleanerCacheService(memoryCache, analysis);

        var first = await cache.GetOrCreateAsync();
        var second = await cache.GetOrCreateAsync();

        Assert.Same(first, second);
        Assert.Equal(1, analysis.ScanCount);

        var refreshed = await cache.RefreshAsync();

        Assert.NotSame(first, refreshed);
        Assert.Equal(2, analysis.ScanCount);
        Assert.Equal(refreshed.ScannedAtUtc, (await cache.GetOrCreateAsync()).ScannedAtUtc);
    }

    private sealed class CountingAnalysisService : IContentCleanerAnalysisService
    {
        public int ScanCount { get; private set; }

        public Task<CleanerScanResponse> ScanAsync(CancellationToken cancellationToken = default)
        {
            ScanCount++;
            var scannedAt = DateTimeOffset.UtcNow.AddTicks(ScanCount);
            return Task.FromResult(new CleanerScanResponse(
                new CleanerSummary(0, 0, 0, 0, 0),
                [],
                scannedAt));
        }
    }
}
