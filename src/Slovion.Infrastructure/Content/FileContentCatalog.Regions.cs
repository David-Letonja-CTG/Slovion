using System.Globalization;
using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>Region loading and validation: every map belongs to exactly one region.</summary>
public sealed partial class FileContentCatalog
{
    private const int MaxPosition = 100;

    private static Dictionary<string, Region> LoadRegions(string folder, HashSet<string> mapIds, IReadOnlySet<string> rewardFlags, List<string> errors)
    {
        var result = new Dictionary<string, Region>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"regions/{Path.GetFileName(file)}";
            var region = Read<RegionFile>(file, name, errors);
            if (region is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (region.Id is null || !MapIdPattern().IsMatch(region.Id))
            {
                errors.Add($"{name}: invalid region ID '{region.Id}' (expected lowercase snake_case).");
            }

            if (region.MapId is null || !mapIds.Contains(region.MapId))
            {
                errors.Add($"{name}: region '{region.Id}' refers to unknown map '{region.MapId}'.");
            }

            if (region.Order is null or < 1)
            {
                errors.Add($"{name}: 'order' must be a positive integer (found {region.Order?.ToString(CultureInfo.InvariantCulture) ?? "none"}).");
            }

            if (region.Position?.X is not (>= 0 and <= MaxPosition) || region.Position?.Y is not (>= 0 and <= MaxPosition))
            {
                errors.Add($"{name}: 'position.x' and 'position.y' must be between 0 and {MaxPosition}.");
            }

            var unlock = ValidateUnlock(region, name, rewardFlags, errors);
            var texts = ValidateRegionTexts(region.Text, name, errors);

            if (errors.Count > errorCount)
            {
                continue;
            }

            var loaded = new Region(region.Id!, region.MapId!, region.Order!.Value, region.Position!.X!.Value, region.Position.Y!.Value, unlock!, texts);
            if (!result.TryAdd(loaded.Id, loaded))
            {
                errors.Add($"{name}: duplicate region ID '{loaded.Id}'.");
            }
        }

        ValidateRegionMaps(result, mapIds, errors);
        return result;
    }

    private static UnlockRule? ValidateUnlock(RegionFile region, string name, IReadOnlySet<string> rewardFlags, List<string> errors)
    {
        var flag = region.Unlock?.Flag;
        var count = region.Unlock?.IdentifiedSpecies;
        if (flag is not null && count is not null)
        {
            errors.Add($"{name}: 'unlock' may name a flag or a number of identified species, not both.");
            return null;
        }

        if (flag is not null)
        {
            if (rewardFlags.Contains(flag))
            {
                return new UnlockRule.Flag(flag);
            }

            errors.Add($"{name}: region '{region.Id}' requires flag '{flag}', which no quest rewards.");
            return null;
        }

        if (count is not null)
        {
            if (count > 0)
            {
                return new UnlockRule.IdentifiedSpecies(count.Value);
            }

            errors.Add($"{name}: 'unlock.identifiedSpecies' must be a positive integer (found {count}).");
            return null;
        }

        return new UnlockRule.Always();
    }

    private static Dictionary<string, RegionText> ValidateRegionTexts(Dictionary<string, RegionTextFile>? files, string name, List<string> errors)
    {
        var texts = new Dictionary<string, RegionText>(StringComparer.Ordinal);
        foreach (var (language, text) in files ?? [])
        {
            if (string.IsNullOrWhiteSpace(text?.Name) || string.IsNullOrWhiteSpace(text.LockedHint))
            {
                errors.Add($"{name}: 'text.{language}' needs a 'name' and a 'lockedHint'.");
            }
            else
            {
                texts[language] = new RegionText(text.Name, text.LockedHint);
            }
        }

        if (files is null || !files.ContainsKey(IContentCatalog.DefaultLanguage))
        {
            errors.Add($"{name}: Slovenian text ('text.{IContentCatalog.DefaultLanguage}') is required.");
        }

        return texts;
    }

    /// <summary>Every map is reached through exactly one region, and new saves have a region to start in.</summary>
    private static void ValidateRegionMaps(Dictionary<string, Region> regions, HashSet<string> mapIds, List<string> errors)
    {
        foreach (var mapId in mapIds.Order(StringComparer.Ordinal))
        {
            var count = regions.Values.Count(region => region.MapId == mapId);
            if (count != 1)
            {
                errors.Add($"maps/{mapId}.json: map '{mapId}' must belong to exactly one region (found {count}).");
            }
        }

        if (!regions.ContainsKey(Region.StartId))
        {
            errors.Add($"regions: the start region '{Region.StartId}' is required.");
        }
    }
}
