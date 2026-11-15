using Microsoft.Extensions.Caching.Memory;
using Umb.ContentCleaner.Models;

namespace Umb.ContentCleaner.Services;

public sealed class ContentCleanerCacheService : IContentCleanerCacheService
{
    public const string CacheKey = "Umb.ContentCleaner.Analysis";

    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(30);
    private static readonly SemaphoreSlim ScanLock = new(1, 1);

    private readonly IMemoryCache _memoryCache;
    private readonly IContentCleanerAnalysisService _analysisService;

    public ContentCleanerCacheService(
        IMemoryCache memoryCache,
        IContentCleanerAnalysisService analysisService)
    {
        _memoryCache = memoryCache;
        _analysisService = analysisService;
    }

    public async Task<CleanerScanResponse> GetOrCreateAsync(CancellationToken cancellationToken = default)
    {
        if (_memoryCache.TryGetValue(CacheKey, out CleanerScanResponse? cached) && cached is not null)
        {
            return cached;
        }

        await ScanLock.WaitAsync(cancellationToken);
        try
        {
            if (_memoryCache.TryGetValue(CacheKey, out cached) && cached is not null)
            {
                return cached;
            }

            return await ScanAndCacheAsync(cancellationToken);
        }
        finally
        {
            ScanLock.Release();
        }
    }

    public async Task<CleanerScanResponse> RefreshAsync(CancellationToken cancellationToken = default)
    {
        await ScanLock.WaitAsync(cancellationToken);
        try
        {
            return await ScanAndCacheAsync(cancellationToken);
        }
        finally
        {
            ScanLock.Release();
        }
    }

    private async Task<CleanerScanResponse> ScanAndCacheAsync(CancellationToken cancellationToken)
    {
        var scan = await _analysisService.ScanAsync(cancellationToken);
        _memoryCache.Set(CacheKey, scan, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheLifetime
        });

        return scan;
    }
}
