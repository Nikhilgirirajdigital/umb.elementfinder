namespace Umb.ElementFinder.Services;

public interface IElementFinderQueryService
{
    /// <summary>Returns a server-side paged list of Element Types.</summary>
    Task<PagedResult<ElementTypeSummary>> GetElementTypesAsync(
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default);

    /// <summary>Returns a server-side paged list of content pages where the selected Element Type is used.</summary>
    Task<PagedResult<PageSummary>> GetPagesForElementTypeAsync(
        string elementTypeAlias,
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default);
}
