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
        builder.Services.AddSingleton<IElementUsageStore, ElementUsageStore>();
        builder.Components().Append<ElementUsageIndexComponent>();
        builder.AddNotificationHandler<ContentSavedNotification, ElementUsageNotificationHandler>();
    }
}
