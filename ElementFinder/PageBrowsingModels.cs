namespace Umb.ElementFinder.Services;

/// <summary>A reusable Element Type entry shown on the first screen.</summary>
public sealed record ElementTypeSummary(string Alias, string Name, string? Icon, long TotalUsageCount);

/// <summary>A content page where the selected Element Type is used.</summary>
public sealed record PageSummary(
    int Id,
    Guid Key,
    string Name,
    bool Published,
    string? Icon,
    int TotalUsagesCount,
    IReadOnlyDictionary<string, int> UsageCountsByCulture);

/// <summary>Server-side paged result returned to the Element Finder dashboard.</summary>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    long TotalItems,
    int TotalPages);
