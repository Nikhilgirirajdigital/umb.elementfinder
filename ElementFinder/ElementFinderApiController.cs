using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umb.ElementFinder.Services;
using Umbraco.Cms.Core;
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

    public ElementFinderApiController(IElementFinderQueryService query)
    {
        _query = query;
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
}
