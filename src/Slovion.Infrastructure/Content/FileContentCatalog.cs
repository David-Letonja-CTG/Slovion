using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>
/// Loads and validates content from <c>species/*.json</c> and <c>maps/*.json</c> under a root folder.
/// Validation collects every problem and fails once, so authors see all errors at the same time.
/// </summary>
public sealed partial class FileContentCatalog : IContentCatalog
{
    private const int TileSize = 16;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Disallow,
    };

    private readonly Dictionary<SpeciesId, Species> species;
    private readonly Dictionary<(string MapId, string SpotId), MapSpot> spots;

    private FileContentCatalog(
        Dictionary<SpeciesId, Species> species,
        Dictionary<(string, string), MapSpot> spots,
        IReadOnlySet<string> languages)
    {
        this.species = species;
        this.spots = spots;
        Languages = languages;
    }

    public IReadOnlySet<string> Languages { get; }

    public Species? FindSpecies(SpeciesId id) => species.GetValueOrDefault(id);

    public MapSpot? FindSpot(string mapId, string spotId) => spots.GetValueOrDefault((mapId, spotId));

    /// <exception cref="ContentValidationException">The content is missing or invalid.</exception>
    public static FileContentCatalog Load(string rootPath)
    {
        var errors = new List<string>();
        if (!Directory.Exists(rootPath))
        {
            throw new ContentValidationException([$"Content folder '{rootPath}' does not exist."]);
        }

        var species = LoadSpecies(Path.Combine(rootPath, "species"), errors);
        var spots = LoadMaps(Path.Combine(rootPath, "maps"), species, errors);

        if (errors.Count > 0)
        {
            throw new ContentValidationException(errors);
        }

        var languages = species.Values.SelectMany(item => item.Text.Keys).ToHashSet(StringComparer.Ordinal);
        languages.Add(IContentCatalog.DefaultLanguage);
        return new FileContentCatalog(species, spots, languages);
    }

    private static Dictionary<SpeciesId, Species> LoadSpecies(string folder, List<string> errors)
    {
        var result = new Dictionary<SpeciesId, Species>();
        foreach (var file in JsonFiles(folder))
        {
            var name = $"species/{Path.GetFileName(file)}";
            var parsed = Read<SpeciesFile>(file, name, errors);
            if (parsed is null)
            {
                continue;
            }

            var item = ValidateSpecies(parsed, name, errors);
            if (item is null)
            {
                continue;
            }

            if (!result.TryAdd(item.Id, item))
            {
                errors.Add($"{name}: duplicate species ID '{item.Id}'.");
            }
        }

        return result;
    }

    private static Species? ValidateSpecies(SpeciesFile file, string name, List<string> errors)
    {
        var errorCount = errors.Count;

        if (!SpeciesId.IsValid(file.Id))
        {
            errors.Add($"{name}: invalid species ID '{file.Id}' (expected genus_species in lowercase ASCII).");
        }

        if (string.IsNullOrWhiteSpace(file.Group))
        {
            errors.Add($"{name}: 'group' is required.");
        }

        var sources = ValidateSources(file.Sources, name, errors);
        var sourceIds = sources.Keys.ToHashSet(StringComparer.Ordinal);
        var scientificName = ValidateFact(file.ScientificName, $"{name}: scientificName", sourceIds, errors);

        var texts = new Dictionary<string, SpeciesText>(StringComparer.Ordinal);
        foreach (var (language, text) in file.Text ?? [])
        {
            var validated = ValidateText(text, $"{name}: text.{language}", sourceIds, errors);
            if (validated is not null)
            {
                texts[language] = validated;
            }
        }

        if (file.Text is null || !file.Text.ContainsKey(IContentCatalog.DefaultLanguage))
        {
            errors.Add($"{name}: Slovenian text ('text.{IContentCatalog.DefaultLanguage}') is required.");
        }

        return errors.Count > errorCount
            ? null
            : new Species(SpeciesId.Parse(file.Id!), file.Group!, scientificName!, sources, texts);
    }

    private static Dictionary<string, Source> ValidateSources(
        Dictionary<string, SourceFile>? files,
        string name,
        List<string> errors)
    {
        var result = new Dictionary<string, Source>(StringComparer.Ordinal);
        if (files is null || files.Count == 0)
        {
            errors.Add($"{name}: at least one source is required.");
            return result;
        }

        foreach (var (id, file) in files)
        {
            var at = $"{name}: source '{id}'";
            var valid = true;
            foreach (var (field, value) in new[] { ("title", file.Title), ("publisher", file.Publisher), ("licence", file.Licence) })
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    errors.Add($"{at} is missing '{field}'.");
                    valid = false;
                }
            }

            if (!Uri.TryCreate(file.Url, UriKind.Absolute, out var url) || (url.Scheme != Uri.UriSchemeHttp && url.Scheme != Uri.UriSchemeHttps))
            {
                errors.Add($"{at} needs an absolute http(s) 'url'.");
                valid = false;
            }

            if (!DateOnly.TryParseExact(file.Accessed, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var accessed))
            {
                errors.Add($"{at} needs 'accessed' as yyyy-MM-dd.");
                valid = false;
            }

            if (valid)
            {
                result[id] = new Source(id, file.Title!, file.Publisher!, url!, accessed, file.Licence!);
            }
        }

        return result;
    }

    private static SpeciesText? ValidateText(SpeciesTextFile text, string at, HashSet<string> sourceIds, List<string> errors)
    {
        var name = ValidateFact(text.Name, $"{at}.name", sourceIds, errors);
        var family = ValidateFact(text.Family, $"{at}.family", sourceIds, errors);
        var habitat = ValidateFact(text.Habitat, $"{at}.habitat", sourceIds, errors);
        var distribution = ValidateFact(text.Distribution, $"{at}.distribution", sourceIds, errors);
        var season = ValidateFact(text.Season, $"{at}.season", sourceIds, errors);

        var characteristics = new List<Fact>();
        if (text.Characteristics is null || text.Characteristics.Count == 0)
        {
            errors.Add($"{at}.characteristics: at least one characteristic is required.");
        }
        else
        {
            for (var i = 0; i < text.Characteristics.Count; i++)
            {
                var fact = ValidateFact(text.Characteristics[i], $"{at}.characteristics[{i}]", sourceIds, errors);
                if (fact is not null)
                {
                    characteristics.Add(fact);
                }
            }
        }

        return name is null || family is null || habitat is null || distribution is null || season is null
               || characteristics.Count != text.Characteristics!.Count
            ? null
            : new SpeciesText(name, family, habitat, distribution, season, characteristics);
    }

    private static Fact? ValidateFact(FactFile? fact, string at, HashSet<string> sourceIds, List<string> errors)
    {
        if (fact is null || string.IsNullOrWhiteSpace(fact.Value))
        {
            errors.Add($"{at} is missing.");
            return null;
        }

        if (fact.Sources is null || fact.Sources.Count == 0)
        {
            errors.Add($"{at} has no sources.");
            return null;
        }

        var unknown = fact.Sources.Where(id => !sourceIds.Contains(id)).ToList();
        if (unknown.Count > 0)
        {
            errors.Add($"{at} references unknown source(s): {string.Join(", ", unknown)}.");
            return null;
        }

        return new Fact(fact.Value, fact.Sources);
    }

    private static Dictionary<(string, string), MapSpot> LoadMaps(
        string folder,
        Dictionary<SpeciesId, Species> species,
        List<string> errors)
    {
        var result = new Dictionary<(string, string), MapSpot>();
        foreach (var file in JsonFiles(folder))
        {
            var mapId = Path.GetFileNameWithoutExtension(file);
            var name = $"maps/{Path.GetFileName(file)}";
            if (!MapIdPattern().IsMatch(mapId))
            {
                errors.Add($"{name}: map file name must be a lowercase snake_case map ID.");
                continue;
            }

            var map = Read<TiledMapFile>(file, name, errors);
            if (map is not null)
            {
                foreach (var spot in ValidateMap(map, mapId, name, species, errors))
                {
                    result[(spot.MapId, spot.SpotId)] = spot;
                }
            }
        }

        return result;
    }

    private static List<MapSpot> ValidateMap(
        TiledMapFile map,
        string mapId,
        string name,
        Dictionary<SpeciesId, Species> species,
        List<string> errors)
    {
        var spots = new List<MapSpot>();
        if (map.Orientation != "orthogonal")
        {
            errors.Add($"{name}: only orthogonal maps are supported.");
        }

        if (map.TileWidth != TileSize || map.TileHeight != TileSize)
        {
            errors.Add($"{name}: tiles must be {TileSize}×{TileSize}.");
        }

        if (map.Width <= 0 || map.Height <= 0)
        {
            errors.Add($"{name}: width and height must be positive.");
            return spots;
        }

        foreach (var layerName in new[] { "ground", "collision" })
        {
            var layer = map.Layers?.FirstOrDefault(l => l.Name == layerName);
            if (layer is null || layer.Type != "tilelayer")
            {
                errors.Add($"{name}: tile layer '{layerName}' is required.");
            }
            else if (layer.Data?.Count != map.Width * map.Height)
            {
                errors.Add($"{name}: tile layer '{layerName}' must have {map.Width * map.Height} tiles.");
            }
        }

        var objects = map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects;
        if (objects is null)
        {
            errors.Add($"{name}: object layer 'objects' is required.");
            return spots;
        }

        var spawnCount = objects.Count(o => o.ObjectClass == "spawn");
        if (spawnCount != 1)
        {
            errors.Add($"{name}: exactly one 'spawn' object is required (found {spawnCount}).");
        }

        var spotIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var spot in objects.Where(o => o.ObjectClass == "spot"))
        {
            var spotId = spot.StringProperty("spotId");
            var speciesId = spot.StringProperty("speciesId");
            var at = $"{name}: spot '{spotId ?? spot.Name}'";

            if (string.IsNullOrWhiteSpace(spotId))
            {
                errors.Add($"{name}: a spot is missing the 'spotId' property.");
                continue;
            }

            if (!spotIds.Add(spotId))
            {
                errors.Add($"{at} is defined more than once.");
            }

            var tileX = (int)Math.Floor(spot.X / TileSize);
            var tileY = (int)Math.Floor(spot.Y / TileSize);
            if (tileX < 0 || tileY < 0 || tileX >= map.Width || tileY >= map.Height)
            {
                errors.Add($"{at} lies outside the map.");
            }

            if (!SpeciesId.IsValid(speciesId) || !species.ContainsKey(SpeciesId.Parse(speciesId!)))
            {
                errors.Add($"{at} references unknown species '{speciesId}'.");
                continue;
            }

            spots.Add(new MapSpot(mapId, spotId, SpeciesId.Parse(speciesId!)));
        }

        return spots;
    }

    private static T? Read<T>(string file, string name, List<string> errors)
        where T : class
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<T>(File.ReadAllText(file), JsonOptions);
            if (parsed is null)
            {
                errors.Add($"{name}: file is empty.");
            }

            return parsed;
        }
        catch (JsonException exception)
        {
            errors.Add($"{name}: invalid JSON ({exception.Message}).");
            return null;
        }
    }

    private static IEnumerable<string> JsonFiles(string folder) =>
        Directory.Exists(folder)
            ? Directory.EnumerateFiles(folder, "*.json").Order(StringComparer.Ordinal)
            : [];

    [GeneratedRegex("^[a-z]+(_[a-z]+)*$")]
    private static partial Regex MapIdPattern();
}
