using System.Text.Json.Serialization;

namespace Umb.ContentCleaner.Models;

// The Content Cleaner client (content-cleaner-dashboard.ts / content-cleaner-usage-workspace.ts)
// expects these enums as their string names (e.g. "Low", "BlockList") to drive risk badges,
// filtering, and usage-type routing. Without this converter, System.Text.Json serializes enums
// as their underlying numbers by default, which silently breaks every string comparison on the
// client (risk colors, "View usage" links, content/data-type/document-type routing) without
// throwing an error anywhere. Pinning the converter here keeps this correct regardless of how
// the host Umbraco site configures its own JSON options.
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CleanupRisk
{
    Low,
    Moderate,
    Review,
    High
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum UsageReferenceType
{
    Content,
    DocumentType,
    ElementType,
    DataType,
    Composition,
    BlockList,
    BlockGrid
}

public sealed record UsageReference(
    Guid? Key,
    string Name,
    UsageReferenceType ReferenceType,
    string? PropertyAlias,
    string? DataTypeName,
    Guid? DataTypeKey,
    string? ContentTypeAlias);

public sealed record CleanupCandidate(
    Guid Key,
    string Name,
    string Alias,
    string Type,
    int UsageCount,
    CleanupRisk Risk,
    string Summary,
    IReadOnlyList<string> Dependencies,
    IReadOnlyCollection<UsageReference> Usages);

public sealed record CleanerSummary(
    int TotalItems,
    int LowRisk,
    int Moderate,
    int Review,
    int HighRisk);

public sealed record CleanerScanResponse(
    CleanerSummary Summary,
    IReadOnlyList<CleanupCandidate> Items,
    DateTimeOffset ScannedAtUtc);

public sealed record CleanerPagedResponse<T>(
    IReadOnlyList<T> Items,
    int Total,
    int Skip,
    int Take,
    DateTimeOffset ScannedAtUtc);
