using Microsoft.Extensions.DependencyInjection;
using Umb.ContentCleaner.Services;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;

namespace Umb.ContentCleaner;

public sealed class ContentCleanerComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddScoped<IBlockConfigurationCleanerService, BlockConfigurationCleanerService>();
        builder.Services.AddScoped<IContentCleanerAnalysisService, ContentCleanerAnalysisService>();
        builder.Services.AddScoped<IContentCleanerCacheService, ContentCleanerCacheService>();

        builder.AddNotificationAsyncHandler<ContentTypeDeletedNotification, BlockCleanupNotificationHandler>();
    }
}
