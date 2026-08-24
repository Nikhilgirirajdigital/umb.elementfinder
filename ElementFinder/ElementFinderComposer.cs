using Microsoft.Extensions.DependencyInjection;
using Umb.ElementFinder.Services;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

namespace Umb.ElementFinder.Composing;

public sealed class ElementFinderComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddSingleton<IElementFinderQueryService, ElementFinderQueryService>();

        // Singleton so the scan is paid for once per application lifetime, and only if the
        // dashboard is actually opened. No database schema of its own, so nothing to migrate.
        builder.Services.AddSingleton<IElementUsageCache, ElementUsageCache>();

        builder.AddNotificationHandler<ContentSavedNotification, ElementUsageNotificationHandler>();
        builder.AddNotificationHandler<ContentMovedToRecycleBinNotification, ElementUsageNotificationHandler>();
        builder.AddNotificationHandler<ContentMovedNotification, ElementUsageNotificationHandler>();
        builder.AddNotificationHandler<ContentDeletedNotification, ElementUsageNotificationHandler>();
    }
}
