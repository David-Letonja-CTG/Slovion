using System.Buffers.Binary;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Infrastructure.Content;

/// <summary>
/// Loads and validates content from <c>species/*.json</c>, <c>species-pictures/*.png</c>, <c>habitats/*.json</c>,
/// <c>npcs/*.json</c>, <c>quests/*.json</c> and <c>maps/*.json</c> under a root folder.
/// Validation collects every problem and fails once, so authors see all errors at the same time.
/// </summary>
public sealed partial class FileContentCatalog : IContentCatalog
{
    private const int TileSize = 16;
    private const int PictureSize = 32;

    /// <summary>Content folder with one picture per species, served to clients as-is.</summary>
    public const string PicturesFolder = "species-pictures";

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Disallow,
    };

    private readonly Dictionary<SpeciesId, Species> species;
    private readonly Dictionary<(string MapId, string SpotId), MapSpot> spots;
    private readonly Dictionary<string, Habitat> habitats;
    private readonly Dictionary<string, List<HabitatZone>> zones;
    private readonly Dictionary<(string MapId, string NpcId), MapNpc> mapNpcs;
    private readonly Dictionary<string, Quest> quests;

    public IReadOnlySet<string> Languages { get; }

    public IReadOnlyCollection<Species> AllSpecies => species.Values;

    public IReadOnlyList<Habitat> AllHabitats { get; }

    private FileContentCatalog(Dictionary<SpeciesId, Species> species, Dictionary<(string, string), MapSpot> spots, Dictionary<string, Habitat> habitats, Dictionary<string, List<HabitatZone>> zones, Dictionary<(string, string), MapNpc> mapNpcs, Dictionary<string, Quest> quests, IReadOnlySet<string> languages)
    {
        this.species = species;
        this.spots = spots;
        this.habitats = habitats;
        this.zones = zones;
        this.mapNpcs = mapNpcs;
        this.quests = quests;
        Languages = languages;
        AllHabitats = habitats.Values.OrderBy(habitat => habitat.Order).ThenBy(habitat => habitat.Id, StringComparer.Ordinal).ToList();
    }

    public Species? FindSpecies(SpeciesId id) => species.GetValueOrDefault(id);

    public MapSpot? FindSpot(string mapId, string spotId) => spots.GetValueOrDefault((mapId, spotId));

    public MapNpc? FindNpcOnMap(string mapId, string npcId) => mapNpcs.GetValueOrDefault((mapId, npcId));

    public Quest? FindQuest(string questId) => quests.GetValueOrDefault(questId);

    public Quest? FindQuestByGiver(string npcId) => quests.Values.FirstOrDefault(quest => quest.GiverId == npcId);

    public Habitat? FindHabitatAt(string mapId, int x, int y) =>
        zones.GetValueOrDefault(mapId)?.FirstOrDefault(zone => zone.Contains(x, y)) is { } zone
            ? habitats[zone.HabitatId]
            : null;

    /// <exception cref="ContentValidationException">The content is missing or invalid.</exception>
    public static FileContentCatalog Load(string rootPath)
    {
        var errors = new List<string>();
        if (!Directory.Exists(rootPath))
        {
            throw new ContentValidationException([$"Content folder '{rootPath}' does not exist."]);
        }

        var species = LoadSpecies(Path.Combine(rootPath, "species"), errors);
        ValidatePictures(Path.Combine(rootPath, PicturesFolder), species, errors);
        var errorsBeforeHabitats = errors.Count;
        var habitats = LoadHabitats(Path.Combine(rootPath, "habitats"), species, errors);
        if (errors.Count == errorsBeforeHabitats)
        {
            // Skipped when a habitat file is invalid, which would otherwise report its species here too.
            ValidateHabitatMembership(species, habitats, errors);
        }

        var npcs = LoadNpcs(Path.Combine(rootPath, "npcs"), errors);
        var quests = LoadQuests(Path.Combine(rootPath, "quests"), npcs, errors);
        ValidateQuestGivers(npcs, quests, errors);
        var rewardFlags = quests.Values.Select(quest => quest.RewardFlag).ToHashSet(StringComparer.Ordinal);
        var (spots, zones, mapNpcs) = LoadMaps(Path.Combine(rootPath, "maps"), species, habitats, npcs, rewardFlags, errors);

        if (errors.Count > 0)
        {
            throw new ContentValidationException(errors);
        }

        var languages = species.Values.SelectMany(item => item.Text.Keys).ToHashSet(StringComparer.Ordinal);
        languages.Add(IContentCatalog.DefaultLanguage);
        return new FileContentCatalog(species, spots, habitats, zones, mapNpcs, quests, languages);
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

        if (!SpeciesGroups.TryParse(file.Group, out var group))
        {
            errors.Add($"{name}: unknown group '{file.Group}' (expected plant, mammal, bird or insect).");
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

        var clues = ValidateClues(file.Identification?.Clues, texts, name, errors);

        return errors.Count > errorCount
            ? null
            : new Species(SpeciesId.Parse(file.Id!), group, scientificName!, sources, texts, clues);
    }

    /// <summary>Exactly three distinct clues, each pointing at a characteristic in every language.</summary>
    private static List<int> ValidateClues(List<int>? clues, Dictionary<string, SpeciesText> texts, string name, List<string> errors)
    {
        const int ClueCount = 3;
        if (clues is null || clues.Count != ClueCount)
        {
            errors.Add($"{name}: 'identification.clues' must list exactly {ClueCount} characteristics (found {clues?.Count ?? 0}).");
            return [];
        }

        if (clues.Distinct().Count() != clues.Count)
        {
            errors.Add($"{name}: 'identification.clues' must not repeat a characteristic.");
        }

        foreach (var (language, text) in texts)
        {
            foreach (var clue in clues.Where(clue => clue < 0 || clue >= text.Characteristics.Count))
            {
                errors.Add($"{name}: clue {clue} has no matching characteristic in text.{language} ({text.Characteristics.Count} characteristics).");
            }
        }

        return clues;
    }

    private static Dictionary<string, Source> ValidateSources(Dictionary<string, SourceFile>? files, string name, List<string> errors)
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

    /// <summary>Every species needs a 32×32 PNG picture; only the signature and IHDR header are read.</summary>
    private static void ValidatePictures(string folder, Dictionary<SpeciesId, Species> species, List<string> errors)
    {
        foreach (var id in species.Keys.Select(id => id.Value).Order(StringComparer.Ordinal))
        {
            var name = $"{PicturesFolder}/{id}.png";
            var file = Path.Combine(folder, $"{id}.png");
            if (!File.Exists(file))
            {
                errors.Add($"{name}: species '{id}' has no picture.");
                continue;
            }

            // PNG signature (8 bytes), then the IHDR chunk: length (4), type (4), width (4), height (4).
            var header = new byte[24];
            using (var stream = File.OpenRead(file))
            {
                stream.ReadAtLeast(header, header.Length, throwOnEndOfStream: false);
            }

            if (!header.AsSpan(0, 8).SequenceEqual(PngSignature) || !"IHDR"u8.SequenceEqual(header.AsSpan(12, 4)))
            {
                errors.Add($"{name}: the picture of species '{id}' is not a PNG.");
                continue;
            }

            var width = BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(16, 4));
            var height = BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(20, 4));
            if (width != PictureSize || height != PictureSize)
            {
                errors.Add($"{name}: the picture of species '{id}' must be {PictureSize}×{PictureSize} pixels (found {width}×{height}).");
            }
        }
    }

    /// <summary>Every species is listed in at least one habitat, so it has a place in the NatureDex.</summary>
    private static void ValidateHabitatMembership(Dictionary<SpeciesId, Species> species, Dictionary<string, Habitat> habitats, List<string> errors)
    {
        var listed = habitats.Values.SelectMany(habitat => habitat.Species).Select(entry => entry.SpeciesId).ToHashSet();
        foreach (var id in species.Keys.Where(id => !listed.Contains(id)).Select(id => id.Value).Order(StringComparer.Ordinal))
        {
            errors.Add($"habitats: species '{id}' is not listed in any habitat.");
        }
    }

    private static Dictionary<string, Habitat> LoadHabitats(string folder, Dictionary<SpeciesId, Species> species, List<string> errors)
    {
        var result = new Dictionary<string, Habitat>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"habitats/{Path.GetFileName(file)}";
            var habitat = Read<HabitatFile>(file, name, errors);
            if (habitat is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (habitat.Id is null || !MapIdPattern().IsMatch(habitat.Id))
            {
                errors.Add($"{name}: invalid habitat ID '{habitat.Id}' (expected lowercase snake_case).");
            }

            var names = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var (language, text) in habitat.Text ?? [])
            {
                if (string.IsNullOrWhiteSpace(text?.Name))
                {
                    errors.Add($"{name}: 'text.{language}.name' is missing.");
                }
                else
                {
                    names[language] = text.Name;
                }
            }

            if (habitat.Text is null || !habitat.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian name ('text.{IContentCatalog.DefaultLanguage}.name') is required.");
            }

            if (habitat.Order is null or < 1)
            {
                errors.Add($"{name}: 'order' must be a positive integer (found {habitat.Order?.ToString(CultureInfo.InvariantCulture) ?? "none"}).");
            }

            if (habitat.SearchChancePercent is < 1 or > 100)
            {
                errors.Add($"{name}: 'searchChancePercent' must be between 1 and 100 (found {habitat.SearchChancePercent}).");
            }

            if (habitat.Species is null || habitat.Species.Count == 0)
            {
                errors.Add($"{name}: at least one species is required.");
            }

            var entries = new List<HabitatSpecies>();
            foreach (var entry in habitat.Species ?? [])
            {
                if (!SpeciesId.IsValid(entry.SpeciesId) || !species.ContainsKey(SpeciesId.Parse(entry.SpeciesId!)))
                {
                    errors.Add($"{name}: unknown species '{entry.SpeciesId}'.");
                }
                else if (entry.Weight <= 0)
                {
                    errors.Add($"{name}: species '{entry.SpeciesId}' needs a positive weight (found {entry.Weight}).");
                }
                else
                {
                    entries.Add(new HabitatSpecies(SpeciesId.Parse(entry.SpeciesId!), entry.Weight));
                }
            }

            if (errors.Count > errorCount)
            {
                continue;
            }

            if (!result.TryAdd(habitat.Id!, new Habitat(habitat.Id!, names, habitat.Order!.Value, habitat.SearchChancePercent, entries)))
            {
                errors.Add($"{name}: duplicate habitat ID '{habitat.Id}'.");
            }
        }

        return result;
    }

    private static (Dictionary<(string, string), MapSpot> Spots, Dictionary<string, List<HabitatZone>> Zones, Dictionary<(string, string), MapNpc> Npcs) LoadMaps(string folder, Dictionary<SpeciesId, Species> species, Dictionary<string, Habitat> habitats, Dictionary<string, Npc> npcs, IReadOnlySet<string> rewardFlags, List<string> errors)
    {
        var result = new Dictionary<(string, string), MapSpot>();
        var zones = new Dictionary<string, List<HabitatZone>>(StringComparer.Ordinal);
        var mapNpcs = new Dictionary<(string, string), MapNpc>();
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

                zones[mapId] = ValidateZones(map, name, habitats, errors);
                foreach (var placed in ValidateMapActors(map, mapId, name, npcs, rewardFlags, errors))
                {
                    mapNpcs[(mapId, placed.Npc.Id)] = placed;
                }
            }
        }

        return (result, zones, mapNpcs);
    }

    /// <summary>Habitat zones: rectangles of class <c>habitat</c>; a tile belongs to a zone if its centre is inside.</summary>
    private static List<HabitatZone> ValidateZones(TiledMapFile map, string name, Dictionary<string, Habitat> habitats, List<string> errors)
    {
        var result = new List<HabitatZone>();
        var objects = map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects ?? [];
        foreach (var zone in objects.Where(o => o.ObjectClass == "habitat"))
        {
            var habitatId = zone.StringProperty("habitatId");
            var at = $"{name}: habitat zone '{zone.Name ?? habitatId}'";
            if (habitatId is null || !habitats.ContainsKey(habitatId))
            {
                errors.Add($"{at} refers to unknown habitat '{habitatId}'.");
                continue;
            }

            // Tile x is covered when its centre (16x + 8) lies in [X, X + Width).
            const double HalfTile = TileSize / 2.0;
            var tiles = new HabitatZone(
                habitatId,
                (int)Math.Ceiling((zone.X - HalfTile) / TileSize),
                (int)Math.Ceiling((zone.Y - HalfTile) / TileSize),
                (int)Math.Ceiling((zone.X + zone.Width - HalfTile) / TileSize) - 1,
                (int)Math.Ceiling((zone.Y + zone.Height - HalfTile) / TileSize) - 1);

            if (tiles.MaxX < tiles.MinX || tiles.MaxY < tiles.MinY)
            {
                errors.Add($"{at} covers no tiles.");
            }
            else if (tiles.MinX < 0 || tiles.MinY < 0 || tiles.MaxX >= map.Width || tiles.MaxY >= map.Height)
            {
                errors.Add($"{at} extends beyond the map.");
            }
            else if (result.Any(other => other.Overlaps(tiles)))
            {
                errors.Add($"{at} overlaps another habitat zone.");
            }
            else
            {
                result.Add(tiles);
            }
        }

        return result;
    }

    private static List<MapSpot> ValidateMap(TiledMapFile map, string mapId, string name, Dictionary<SpeciesId, Species> species, List<string> errors)
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
