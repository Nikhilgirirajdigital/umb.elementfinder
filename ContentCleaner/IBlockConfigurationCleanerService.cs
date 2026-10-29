namespace Umb.ContentCleaner.Services;

/// <summary>
/// Service responsible for cleaning up block references (Block List, Block Grid, etc.)
/// from Data Types when an Element Type or Document Type is deleted.
/// </summary>
public interface IBlockConfigurationCleanerService
{
    /// <summary>
    /// Removes all block configurations referencing the specified element or content type key.
    /// </summary>
    Task<int> RemoveBlockReferencesAsync(Guid elementOrContentTypeKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes all block configurations referencing any of the specified element or content type keys.
    /// </summary>
    Task<int> RemoveBlockReferencesAsync(IReadOnlySet<Guid> elementOrContentTypeKeys, CancellationToken cancellationToken = default);
}
