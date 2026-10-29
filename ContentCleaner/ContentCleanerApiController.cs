using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Umb.ContentCleaner.Models;
using Umb.ContentCleaner.Services;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Web.Common.Authorization;

namespace Umb.ContentCleaner;

[ApiController]
[Produces("application/json")]
[Route("umbraco/backoffice/elementfinder/content-cleaner")]
[Authorize(
    Policy = AuthorizationPolicies.SectionAccessSettings,
    AuthenticationSchemes = Constants.Security.BackOfficeAuthenticationType)]
public sealed class ContentCleanerApiController : ControllerBase
{
    private readonly IContentCleanerCacheService _cacheService;
    private readonly IContentTypeService _contentTypeService;
    private readonly IDataTypeService? _dataTypeService;
    private readonly IBlockConfigurationCleanerService? _blockCleanerService;

    [ActivatorUtilitiesConstructor]
    public ContentCleanerApiController(
        IContentCleanerCacheService cacheService,
        IContentTypeService contentTypeService = null!,
        IDataTypeService? dataTypeService = null,
        IBlockConfigurationCleanerService? blockCleanerService = null)
    {
        _cacheService = cacheService;
        _contentTypeService = contentTypeService;
        _dataTypeService = dataTypeService;
        _blockCleanerService = blockCleanerService;
    }

    [HttpGet("scan")]
    [ProducesResponseType(typeof(CleanerScanResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CleanerScanResponse>> Scan(CancellationToken cancellationToken)
    {
        return Ok(await _cacheService.RefreshAsync(cancellationToken));
    }

    [HttpGet("snapshot")]
    [ProducesResponseType(typeof(CleanerScanResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CleanerScanResponse>> Snapshot(CancellationToken cancellationToken)
    {
        return Ok(await _cacheService.GetOrCreateAsync(cancellationToken));
    }

    [HttpGet("candidates")]
    [ProducesResponseType(typeof(CleanerPagedResponse<CleanupCandidate>), StatusCodes.Status200OK)]
    public async Task<ActionResult<CleanerPagedResponse<CleanupCandidate>>> Candidates(
        CancellationToken cancellationToken,
        int skip = 0,
        int take = 20,
        string? search = null,
        string? type = null,
        string? risk = null,
        string sortBy = "name",
        string sortDirection = "asc")
    {
        take = Math.Clamp(take, 1, 100);
        skip = Math.Max(0, skip);

        var scan = await _cacheService.GetOrCreateAsync(cancellationToken);
        IEnumerable<CleanupCandidate> query = scan.Items;

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Name.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                x.Alias.Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (type.Equals("Element Type", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(x => x.Type.Equals("Document Type", StringComparison.OrdinalIgnoreCase));
            }
            else
            {
                query = query.Where(x => x.Type.Equals(type, StringComparison.OrdinalIgnoreCase));
            }
        }

        if (!string.IsNullOrWhiteSpace(risk) &&
            !risk.Equals("all", StringComparison.OrdinalIgnoreCase) &&
            Enum.TryParse<CleanupRisk>(risk, true, out var parsedRisk))
        {
            query = query.Where(x => x.Risk == parsedRisk);
        }

        var descending = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);
        query = sortBy.ToLowerInvariant() switch
        {
            "type" => descending
                ? query.OrderByDescending(x => x.Type, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                : query.OrderBy(x => x.Type, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
            "usage" => descending
                ? query.OrderByDescending(x => x.UsageCount).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                : query.OrderBy(x => x.UsageCount).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
            "risk" => descending
                ? query.OrderByDescending(x => RiskSort(x.Risk)).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                : query.OrderBy(x => RiskSort(x.Risk)).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
            _ => descending
                ? query.OrderByDescending(x => x.Name, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Type, StringComparer.OrdinalIgnoreCase)
                : query.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Type, StringComparer.OrdinalIgnoreCase)
        };

        var filtered = query.ToArray();

        return Ok(new CleanerPagedResponse<CleanupCandidate>(
            filtered.Skip(skip).Take(take).ToArray(),
            filtered.Length,
            skip,
            take,
            scan.ScannedAtUtc));
    }

    [HttpGet("candidate/{key:guid}")]
    [ProducesResponseType(typeof(CleanupCandidate), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CleanupCandidate>> GetCandidate(
        Guid key,
        CancellationToken cancellationToken)
    {
        var scan = await _cacheService.GetOrCreateAsync(cancellationToken);
        var candidate = scan.Items.FirstOrDefault(x => x.Key == key);
        if (candidate is null)
        {
            return NotFound(new { message = $"Candidate with key '{key}' was not found in the latest scan." });
        }

        return Ok(candidate);
    }

    [HttpDelete("candidate/{key:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCandidate(
        Guid key,
        [FromQuery] string type,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            return BadRequest(new { message = "Item type is required." });
        }

        var scan = await _cacheService.GetOrCreateAsync(cancellationToken);
        var candidate = scan.Items.FirstOrDefault(x => x.Key == key && (
            x.Type.Equals(type, StringComparison.OrdinalIgnoreCase) ||
            (type.Equals("Element Type", StringComparison.OrdinalIgnoreCase) && x.Type.Equals("Document Type", StringComparison.OrdinalIgnoreCase))));

        if (candidate is null)
        {
            return NotFound(new { message = $"The specified {type} was not found in the latest scan." });
        }

        var success = await DeleteItemAsync(key, type);
        if (!success)
        {
            return BadRequest(new { message = $"Failed to delete {type} '{candidate.Name}'." });
        }

        await _cacheService.RefreshAsync(cancellationToken);
        return Ok(new { message = $"{candidate.Type} '{candidate.Name}' was successfully deleted." });
    }

    public sealed record BatchDeleteItem(Guid Key, string Type);
    public sealed record BatchDeleteRequest(IReadOnlyCollection<BatchDeleteItem> Items);

    [HttpPost("batch-delete")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BatchDeleteCandidates(
        [FromBody] BatchDeleteRequest request,
        CancellationToken cancellationToken)
    {
        if (request?.Items is null || request.Items.Count == 0)
        {
            return BadRequest(new { message = "No items specified for deletion." });
        }

        var contentKeys = request.Items
            .Where(x => x.Type.Equals("Element Type", StringComparison.OrdinalIgnoreCase) ||
                        x.Type.Equals("Document Type", StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Key)
            .ToHashSet();

        if (contentKeys.Count > 0 && _blockCleanerService is not null)
        {
            try
            {
                await _blockCleanerService.RemoveBlockReferencesAsync(contentKeys, cancellationToken);
            }
            catch
            {
                // Non-fatal reference cleanup failure should not prevent deletion
            }
        }

        var deletedCount = 0;
        foreach (var item in request.Items)
        {
            if (await DeleteItemAsync(item.Key, item.Type))
            {
                deletedCount++;
            }
        }

        await _cacheService.RefreshAsync(cancellationToken);
        return Ok(new { message = $"Successfully deleted {deletedCount} item(s)." });
    }

    private async Task<bool> DeleteItemAsync(Guid key, string type)
	{
		if (type.Equals("Document Type", StringComparison.OrdinalIgnoreCase) ||
		    type.Equals("Element Type", StringComparison.OrdinalIgnoreCase))
		{
			var contentType = _contentTypeService.Get(key);

			if (contentType is not null)
			{
				if (_blockCleanerService is not null)
				{
					try
					{
						await _blockCleanerService.RemoveBlockReferencesAsync(key);
					}
					catch
					{
						// Non-fatal reference cleanup failure should not prevent deletion
					}
				}

				_contentTypeService.Delete(contentType, -1);
				return true;
			}
		}
		else if (type.Equals("Property", StringComparison.OrdinalIgnoreCase))
		{
			var parentContentType = _contentTypeService
				.GetAll()
				.FirstOrDefault(ct => ct.PropertyTypes.Any(p => p.Key == key));

			var propertyType = parentContentType?
				.PropertyTypes
				.FirstOrDefault(p => p.Key == key);

			if (parentContentType is not null && propertyType is not null)
			{
				parentContentType.RemovePropertyType(propertyType.Alias);

				await _contentTypeService.UpdateAsync(
					parentContentType,
					Constants.Security.SuperUserKey);

				return true;
			}
		}
		else if (type.Equals("Data Type", StringComparison.OrdinalIgnoreCase))
		{
			if (_dataTypeService is not null)
			{
				var dataType = await _dataTypeService.GetAsync(key);

				if (dataType is not null)
				{
					await _dataTypeService.DeleteAsync(
						key,
						Constants.Security.SuperUserKey);

					return true;
				}
			}
		}

		return false;
	}

    private static int RiskSort(CleanupRisk risk) => risk switch
    {
        CleanupRisk.Low => 0,
        CleanupRisk.Moderate => 1,
        CleanupRisk.Review => 2,
        CleanupRisk.High => 3,
        _ => 4
    };
}
