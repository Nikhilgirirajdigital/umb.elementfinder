using System.Text.RegularExpressions;
using Umbraco.Cms.Core.Models;

namespace Umb.ElementFinder.Services;

internal static partial class ElementUsageExtractor
{
    [GeneratedRegex("\\\"contentTypeKey\\\"\\s*:\\s*\\\"(?<key>[0-9a-fA-F-]{36})\\\"", RegexOptions.CultureInvariant)]
    private static partial Regex ContentTypeKeyRegex();

    public static Dictionary<Guid, int> FromContent(IContent content)
        => FromContentByCulture(content).ToDictionary(
            usage => usage.Key,
            usage => usage.Value.Values.Sum());

    public static Dictionary<Guid, Dictionary<string, int>> FromContentByCulture(IContent content)
    {
        var counts = new Dictionary<Guid, Dictionary<string, int>>();
        foreach (var property in content.Properties)
        foreach (var value in property.Values)
        {
            // Edited and published values commonly contain the same data. Count whichever
            // version has more occurrences so a published block is not counted twice.
            var edited = CountFromValue(value.EditedValue);
            var published = CountFromValue(value.PublishedValue);
            var culture = string.IsNullOrWhiteSpace(value.Culture) ? "Invariant" : value.Culture;
            foreach (var (key, count) in MergeByMaximum(edited, published))
            {
                if (!counts.TryGetValue(key, out var cultureCounts))
                    counts[key] = cultureCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                cultureCounts[culture] = cultureCounts.GetValueOrDefault(culture) + count;
            }
        }
        return counts;
    }

    public static Dictionary<Guid, int> FromValues(params string?[] values)
    {
        var counts = new Dictionary<Guid, int>();
        foreach (var value in values)
        foreach (var (key, count) in CountFromValue(value))
            counts[key] = counts.GetValueOrDefault(key) + count;
        return counts;
    }

    private static Dictionary<Guid, int> CountFromValue(object? value)
    {
        var counts = new Dictionary<Guid, int>();
        if (value is not string text || text.Length == 0) return counts;
        foreach (Match match in ContentTypeKeyRegex().Matches(text))
            if (Guid.TryParse(match.Groups["key"].Value, out var key))
                counts[key] = counts.GetValueOrDefault(key) + 1;
        return counts;
    }

    private static Dictionary<Guid, int> MergeByMaximum(
        IReadOnlyDictionary<Guid, int> first,
        IReadOnlyDictionary<Guid, int> second)
    {
        var result = new Dictionary<Guid, int>(first);
        foreach (var (key, count) in second)
            result[key] = Math.Max(result.GetValueOrDefault(key), count);
        return result;
    }
}
