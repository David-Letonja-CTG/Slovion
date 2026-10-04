using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>Research station loading and validation: station files, and the map objects that place them.</summary>
public sealed partial class FileContentCatalog
{
    /// <summary>A valid station file, before its map is known.</summary>
    private sealed record StationDraft(string Id, IReadOnlyList<SpeciesId> Species, int Goal, IReadOnlyDictionary<string, StationText> Text);

    /// <summary>A <c>station</c> object on a map, naming a station.</summary>
    private sealed record StationPlacement(string MapId, string? StationId, string At);

    private static Dictionary<string, StationDraft> LoadStations(string folder, Dictionary<SpeciesId, Species> species, List<string> errors)
    {
        var result = new Dictionary<string, StationDraft>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"stations/{Path.GetFileName(file)}";
            var station = Read<StationFile>(file, name, errors);
            if (station is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (station.Id is null || !MapIdPattern().IsMatch(station.Id))
            {
                errors.Add($"{name}: invalid station ID '{station.Id}' (expected lowercase snake_case).");
            }

            var listed = new List<SpeciesId>();
            foreach (var id in station.Species ?? [])
            {
                if (!SpeciesId.IsValid(id) || !species.ContainsKey(SpeciesId.Parse(id)))
                {
                    errors.Add($"{name}: unknown species '{id}'.");
                }
                else if (listed.Contains(SpeciesId.Parse(id)))
                {
                    errors.Add($"{name}: species '{id}' is listed more than once.");
                }
                else
                {
                    listed.Add(SpeciesId.Parse(id));
                }
            }

            var count = station.Species?.Count ?? 0;
            if (station.Goal is not { } goal || goal < 1 || goal > count)
            {
                errors.Add($"{name}: 'goal' must be between 1 and the number of species ({count}) (found {station.Goal?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "none"}).");
            }

            var texts = new Dictionary<string, StationText>(StringComparer.Ordinal);
            foreach (var (language, text) in station.Text ?? [])
            {
                if (string.IsNullOrWhiteSpace(text?.Name) || string.IsNullOrWhiteSpace(text.Theme))
                {
                    errors.Add($"{name}: 'text.{language}' needs a 'name' and a 'theme'.");
                }
                else
                {
                    texts[language] = new StationText(text.Name, text.Theme);
                }
            }

            if (station.Text is null || !station.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian text ('text.{IContentCatalog.DefaultLanguage}') is required.");
            }

            if (errors.Count > errorCount)
            {
                continue;
            }

            if (!result.TryAdd(station.Id!, new StationDraft(station.Id!, listed, station.Goal!.Value, texts)))
            {
                errors.Add($"{name}: duplicate station ID '{station.Id}'.");
            }
        }

        return result;
    }

    /// <summary>The <c>station</c> tile objects of a map; their position and <c>gid</c> are checked with the other map actors.</summary>
    private static IEnumerable<StationPlacement> StationPlacementsOf(TiledMapFile map, string mapId, string name) =>
        (map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects ?? [])
            .Where(o => o.ObjectClass == "station")
            .Select(o => new StationPlacement(mapId, o.StringProperty("stationId"), $"{name}: station '{o.Name}'"));

    /// <summary>Every station is placed on exactly one map, and every placement names a known station.</summary>
    private static Dictionary<string, Station> PlaceStations(Dictionary<string, StationDraft> drafts, List<StationPlacement> placements, List<string> errors)
    {
        foreach (var placement in placements.Where(placement => placement.StationId is null || !drafts.ContainsKey(placement.StationId)))
        {
            errors.Add($"{placement.At} refers to unknown station '{placement.StationId}'.");
        }

        var result = new Dictionary<string, Station>(StringComparer.Ordinal);
        foreach (var draft in drafts.Values)
        {
            var maps = placements.Where(placement => placement.StationId == draft.Id).Select(placement => placement.MapId).ToList();
            if (maps.Count != 1)
            {
                errors.Add($"stations/{draft.Id}.json: station '{draft.Id}' must be placed on exactly one map (found {maps.Count}).");
                continue;
            }

            result[draft.Id] = new Station(draft.Id, maps[0], draft.Species, draft.Goal, draft.Text);
        }

        return result;
    }
}
