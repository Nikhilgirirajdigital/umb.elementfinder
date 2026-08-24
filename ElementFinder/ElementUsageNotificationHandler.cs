using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Umb.ElementFinder.Services;

/// <summary>
/// Keeps the in-memory usage index in step with content changes. Saves patch the affected
/// item in place; anything that changes which content is visible drops the index instead,
/// because the rebuild filters out trashed nodes.
/// </summary>
internal sealed class ElementUsageNotificationHandler :
    INotificationHandler<ContentSavedNotification>,
    INotificationHandler<ContentMovedToRecycleBinNotification>,
    INotificationHandler<ContentMovedNotification>,
    INotificationHandler<ContentDeletedNotification>
{
    private readonly IElementUsageCache _cache;

    public ElementUsageNotificationHandler(IElementUsageCache cache) => _cache = cache;

    public void Handle(ContentSavedNotification notification)
    {
        foreach (var content in notification.SavedEntities) _cache.Update(content);
    }

    public void Handle(ContentMovedToRecycleBinNotification notification) => _cache.Invalidate();

    public void Handle(ContentMovedNotification notification) => _cache.Invalidate();

    public void Handle(ContentDeletedNotification notification) => _cache.Invalidate();
}
