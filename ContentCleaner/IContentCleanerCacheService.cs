using Umb.ContentCleaner.Models;

namespace Umb.ContentCleaner.Services;

public interface IContentCleanerCacheService
{
    Task<CleanerScanResponse> GetOrCreateAsync(CancellationToken cancellationToken = default);

    Task<CleanerScanResponse> RefreshAsync(CancellationToken cancellationToken = default);
}
