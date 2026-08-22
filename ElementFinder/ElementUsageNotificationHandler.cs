using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;

namespace Umb.ElementFinder.Services;

internal sealed class ElementUsageNotificationHandler : INotificationHandler<ContentSavedNotification>
{
    private readonly IElementUsageStore _store;
    public ElementUsageNotificationHandler(IElementUsageStore store) => _store = store;
    public void Handle(ContentSavedNotification notification)
    {
        foreach (var content in notification.SavedEntities) _store.Replace(content);
    }
}
