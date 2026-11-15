using Umb.ContentCleaner.Models;

namespace Umb.ContentCleaner.Services;

public interface IContentCleanerAnalysisService
{
    Task<CleanerScanResponse> ScanAsync(CancellationToken cancellationToken = default);
}
