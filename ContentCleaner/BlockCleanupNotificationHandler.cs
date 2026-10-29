using Microsoft.Extensions.Logging;
using Umb.ElementFinder.Services;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Umb.ContentCleaner.Services;

/// <summary>
/// When an Element Type or Document Type is deleted anywhere in Umbraco (such as from
/// the Settings > Document Types section in the Backoffice), this notification handler
/// automatically removes any block configurations in Block List / Block Grid Data Types
/// that reference the deleted item, preventing orphaned blocks and undefined errors.
/// </summary>
public sealed class BlockCleanupNotificationHandler : INotificationAsyncHandler<ContentTypeDeletedNotification>
{
    private readonly IBlockConfigurationCleanerService _cleanerService;
    private readonly IElementUsageCache _elementUsageCache;
    private readonly IContentCleanerCacheService _contentCleanerCache;
    private readonly ILogger<BlockCleanupNotificationHandler> _logger;

    public BlockCleanupNotificationHandler(
        IBlockConfigurationCleanerService cleanerService,
        IElementUsageCache elementUsageCache,
        IContentCleanerCacheService contentCleanerCache,
        ILogger<BlockCleanupNotificationHandler> logger)
    {
        _cleanerService = cleanerService;
        _elementUsageCache = elementUsageCache;
        _contentCleanerCache = contentCleanerCache;
        _logger = logger;
    }

    public async Task HandleAsync(ContentTypeDeletedNotification notification, CancellationToken cancellationToken)
    {
        var deletedKeys = notification.DeletedEntities
            .Select(x => x.Key)
            .ToHashSet();

        if (deletedKeys.Count == 0)
        {
            return;
        }

        try
        {
            await _cleanerService.RemoveBlockReferencesAsync(deletedKeys, cancellationToken);
            _elementUsageCache.Invalidate();
            await _contentCleanerCache.RefreshAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error while cleaning up block configurations after content type deletion.");
        }
    }
}
