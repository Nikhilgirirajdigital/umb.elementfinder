using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umb.ElementFinder.Services;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Authorization;

namespace Umb.ElementFinder.Controllers;

/// <summary>
/// AuthenticationSchemes is required here, not just Policy - without it, ASP.NET Core falls
/// back to whatever the app's default authentication scheme is (usually the front-end/member
/// cookie, or none), rather than the backoffice cookie, and every request 401s regardless of
/// whether you're logged into the backoffice. This matches Umbraco's own documented pattern
/// for custom backoffice-authorized controllers.
/// </summary>
[ApiController]
[Produces("application/json")]
[Route("umbraco/backoffice/elementfinder/[action]")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess, AuthenticationSchemes = Constants.Security.BackOfficeAuthenticationType)]
public sealed class ElementFinderApiController : ControllerBase
{
    private readonly IElementFinderQueryService _query;
    private readonly IContentService _contentService;
    private readonly IContentTypeService _contentTypeService;

    public ElementFinderApiController(
        IElementFinderQueryService query,
        IContentService contentService,
        IContentTypeService contentTypeService)
    {
        _query = query;
        _contentService = contentService;
        _contentTypeService = contentTypeService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ElementTypeSummary>>> ElementTypes(
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default)
        => Ok(await _query.GetElementTypesAsync(page, pageSize, search, ct));

    [HttpGet]
    public async Task<ActionResult<PagedResult<PageSummary>>> PagesForElementType(
        string elementTypeAlias,
        int page = 1,
        int pageSize = 20,
        string? search = null,
        CancellationToken ct = default)
        => Ok(await _query.GetPagesForElementTypeAsync(elementTypeAlias, page, pageSize, search, ct));

    /// <summary>
    /// Returns the property aliases on a content node whose values contain the given
    /// Element Type. Used by the dashboard to scroll to the correct property when a
    /// content workspace slide-out is opened from the "Go to Page" button.
    /// </summary>
    [HttpGet]
    public ActionResult<IReadOnlyList<string>> PropertyAliasesForElement(
        Guid contentKey,
        string elementTypeAlias)
    {
        var content = _contentService.GetById(contentKey);
        if (content is null)
            return NotFound(new { message = $"Content with key '{contentKey}' was not found." });

        var elementType = _contentTypeService.Get(elementTypeAlias);
        if (elementType is null || !elementType.IsElement)
            return Ok(Array.Empty<string>());

        var targetKey = elementType.Key;
        var matchingAliases = new List<string>();

        foreach (var property in content.Properties)
        {
            var hasMatch = property.Values.Any(value =>
            {
                var usages = ElementUsageExtractor.FromValues(
                    value.EditedValue?.ToString(),
                    value.PublishedValue?.ToString());
                return usages.ContainsKey(targetKey);
            });

            if (hasMatch)
                matchingAliases.Add(property.Alias);
        }

        return Ok(matchingAliases);
    }
}
