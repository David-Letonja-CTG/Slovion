using System.Globalization;
using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.World;

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
            var weather = ValidateWeather(region.Weather, name, errors);

            if (errors.Count > errorCount)
            {
                continue;
            }

            var loaded = new Region(region.Id!, region.MapId!, region.Order!.Value, region.Position!.X!.Value, region.Position.Y!.Value, unlock!, texts, weather);
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

    /// <summary>Positive weights for one or more weather kinds in every season (fictional gameplay data, D11).</summary>
    private static Dictionary<Season, IReadOnlyDictionary<Weather, int>> ValidateWeather(Dictionary<string, Dictionary<string, int>>? file, string name, List<string> errors)
    {
        var result = new Dictionary<Season, IReadOnlyDictionary<Weather, int>>();
        var seasons = Enum.GetValues<Season>().ToDictionary(season => season.ToString().ToLowerInvariant(), StringComparer.Ordinal);
        var kinds = Enum.GetValues<Weather>().ToDictionary(kind => kind.ToString().ToLowerInvariant(), StringComparer.Ordinal);
        foreach (var (seasonName, season) in seasons)
        {
            if (file?.GetValueOrDefault(seasonName) is not { Count: > 0 } weights)
            {
                errors.Add($"{name}: 'weather.{seasonName}' needs weights for one or more weather kinds.");
                continue;
            }

            var parsed = new Dictionary<Weather, int>();
            foreach (var (kindName, weight) in weights)
            {
                if (!kinds.TryGetValue(kindName, out var kind))
                {
                    errors.Add($"{name}: 'weather.{seasonName}' has unknown weather '{kindName}' (expected clear, cloudy, rain, fog or snow).");
                }
                else if (weight <= 0)
                {
                    errors.Add($"{name}: 'weather.{seasonName}.{kindName}' must be a positive weight (found {weight}).");
                }
                else
                {
                    parsed[kind] = weight;
                }
            }

            result[season] = parsed;
        }

        foreach (var unknown in (file?.Keys.AsEnumerable() ?? []).Where(key => !seasons.ContainsKey(key)))
        {
            errors.Add($"{name}: 'weather' has unknown season '{unknown}'.");
        }

        return result;
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
