using System.Buffers.Binary;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.World;

namespace Slovion.Infrastructure.Content;

/// <summary>
/// Loads and validates content from <c>species/*.json</c>, <c>species-pictures/*.png</c>, <c>habitats/*.json</c>,
/// <c>npcs/*.json</c>, <c>quests/*.json</c>, <c>maps/*.json</c> and <c>regions/*.json</c> under a root folder.
/// Validation collects every problem and fails once, so authors see all errors at the same time.
/// </summary>
public sealed partial class FileContentCatalog : IContentCatalog
{
    private const int TileSize = 16;
    private const int PictureSize = 32;

    /// <summary>Content folder with one picture per species, served to clients as-is.</summary>
    public const string PicturesFolder = "species-pictures";

    /// <summary>Content folder with the named places of the maps, served to clients as-is.</summary>
    public const string AreasFolder = "areas";

    /// <summary>Content folder with the walk sprites of animals (two 16×16 frames facing right).</summary>
    public const string WildlifeSpritesFolder = "wildlife-sprites";

    /// <summary>Content folder with the 4-facing sprite sheets of NPCs (same layout as the player).</summary>
    public const string NpcSpritesFolder = "npc-sprites";

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Disallow,
    };

    private readonly Dictionary<SpeciesId, Species> species;
    private readonly Dictionary<(string MapId, string SpotId), MapSpot> spots;
    private readonly Dictionary<string, Habitat> habitats;
    private readonly Dictionary<string, List<MapZone>> zones;
    private readonly Dictionary<(string MapId, string NpcId), MapNpc> mapNpcs;
    private readonly Dictionary<string, Quest> quests;
    private readonly Dictionary<string, Region> regions;
    private readonly List<Item> items;
    private readonly Dictionary<string, Station> stations;

    public IReadOnlySet<string> Languages { get; }

    public IReadOnlyCollection<Species> AllSpecies => species.Values;

    public IReadOnlyList<Habitat> AllHabitats { get; }

    public IReadOnlyList<Region> AllRegions { get; }

    public IReadOnlyList<Item> AllItems => items;

    public IReadOnlyList<Station> AllStations { get; }

    private FileContentCatalog(Dictionary<SpeciesId, Species> species, Dictionary<(string, string), MapSpot> spots, Dictionary<string, Habitat> habitats, Dictionary<string, List<MapZone>> zones, Dictionary<(string, string), MapNpc> mapNpcs, Dictionary<string, Quest> quests, Dictionary<string, Region> regions, List<Item> items, Dictionary<string, Station> stations, IReadOnlySet<string> languages)
    {
        this.species = species;
        this.spots = spots;
        this.habitats = habitats;
        this.zones = zones;
        this.mapNpcs = mapNpcs;
        this.quests = quests;
        this.regions = regions;
        this.items = items;
        this.stations = stations;
        Languages = languages;
        AllHabitats = habitats.Values.OrderBy(habitat => habitat.Order).ThenBy(habitat => habitat.Id, StringComparer.Ordinal).ToList();
        AllRegions = regions.Values.OrderBy(region => region.Order).ThenBy(region => region.Id, StringComparer.Ordinal).ToList();
        AllStations = stations.Values
            .OrderBy(station => FindRegionOfMap(station.MapId)?.Order ?? int.MaxValue)
            .ThenBy(station => station.Id, StringComparer.Ordinal)
            .ToList();
    }

    public Species? FindSpecies(SpeciesId id) => species.GetValueOrDefault(id);

    public MapSpot? FindSpot(string mapId, string spotId) => spots.GetValueOrDefault((mapId, spotId));

    public IReadOnlyList<MapSpot>? SpotsOn(string mapId) =>
        zones.ContainsKey(mapId) ? spots.Values.Where(spot => spot.MapId == mapId).ToList() : null;

    public MapNpc? FindNpcOnMap(string mapId, string npcId) => mapNpcs.GetValueOrDefault((mapId, npcId));

    public Quest? FindQuest(string questId) => quests.GetValueOrDefault(questId);

    public Region? FindRegion(string regionId) => regions.GetValueOrDefault(regionId);

    public Item? FindItem(string itemId) => items.FirstOrDefault(item => item.Id == itemId);

    public Station? FindStation(string stationId) => stations.GetValueOrDefault(stationId);

    public Region? FindRegionOfMap(string mapId) => regions.Values.FirstOrDefault(region => region.MapId == mapId);

    public Quest? FindQuestByGiver(string npcId) => quests.Values.FirstOrDefault(quest => quest.GiverId == npcId);

    public Habitat? FindHabitatAt(string mapId, int x, int y) =>
        zones.GetValueOrDefault(mapId)?.FirstOrDefault(zone => zone.Contains(x, y)) is { } zone
            ? habitats[zone.Id]
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
        var speciesIds = species.Keys.Select(id => id.Value).ToList();
        ValidateImages(Path.Combine(rootPath, PicturesFolder), PicturesFolder, speciesIds, "species", "picture", PictureSize, PictureSize, errors);
        var animalIds = species.Values.Where(item => item.Group != SpeciesGroup.Plant).Select(item => item.Id.Value).ToList();
        ValidateImages(Path.Combine(rootPath, WildlifeSpritesFolder), WildlifeSpritesFolder, animalIds, "species", "walk sprite", 32, 16, errors);
        var errorsBeforeHabitats = errors.Count;
        var habitats = LoadHabitats(Path.Combine(rootPath, "habitats"), species, errors);
        if (errors.Count == errorsBeforeHabitats)
        {
            // Skipped when a habitat file is invalid, which would otherwise report its species here too.
            ValidateHabitatMembership(species, habitats, errors);
        }

        var npcs = LoadNpcs(Path.Combine(rootPath, "npcs"), errors);
        ValidateImages(Path.Combine(rootPath, NpcSpritesFolder), NpcSpritesFolder, npcs.Keys.ToList(), "NPC", "sprite", 32, 64, errors);
        var items = LoadItems(Path.Combine(rootPath, "items"), errors);
        ValidateImages(Path.Combine(rootPath, ItemIconsFolder), ItemIconsFolder, items.Select(item => item.Id).ToList(), "tool", "icon", ItemIconSize, ItemIconSize, errors);
        var quests = LoadQuests(Path.Combine(rootPath, "quests"), npcs, habitats, items, errors);
        ValidateItemRewards(items, quests, errors);
        ValidateQuestGivers(npcs, quests, errors);
        var rewardFlags = quests.Values.Select(quest => quest.RewardFlag).ToHashSet(StringComparer.Ordinal);
        var areas = LoadAreas(Path.Combine(rootPath, AreasFolder), errors);
        var stationDrafts = LoadStations(Path.Combine(rootPath, "stations"), species, errors);
        var (spots, zones, mapNpcs, stationPlacements) = LoadMaps(Path.Combine(rootPath, "maps"), species, habitats, areas, npcs, rewardFlags, errors);
        var stations = PlaceStations(stationDrafts, stationPlacements, errors);
        var regions = LoadRegions(Path.Combine(rootPath, "regions"), zones.Keys.ToHashSet(StringComparer.Ordinal), rewardFlags, errors);

        if (errors.Count > 0)
        {
            throw new ContentValidationException(errors);
        }

        var languages = species.Values.SelectMany(item => item.Text.Keys).ToHashSet(StringComparer.Ordinal);
        languages.Add(IContentCatalog.DefaultLanguage);
        return new FileContentCatalog(species, spots, habitats, zones, mapNpcs, quests, regions, items, stations, languages);
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
            errors.Add($"{name}: unknown group '{file.Group}' (expected plant, mammal, bird, insect or amphibian).");
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
        var availability = ValidateAvailability(file.Availability, name, sourceIds, errors);
        var wildlife = ValidateWildlife(file.Wildlife, group, name, errors);

        return errors.Count > errorCount
            ? null
            : new Species(SpeciesId.Parse(file.Id!), group, scientificName!, sources, texts, clues, availability!, wildlife);
    }

    /// <summary>Animals need wildlife traits (gameplay data); plants must not have any.</summary>
    private static WildlifeTraits? ValidateWildlife(WildlifeFile? file, SpeciesGroup group, string name, List<string> errors)
    {
        if (group == SpeciesGroup.Plant)
        {
            if (file is not null)
            {
                errors.Add($"{name}: plants must not declare 'wildlife' traits.");
            }

            return null;
        }

        if (file is null)
        {
            errors.Add($"{name}: 'wildlife' traits are required for animals.");
            return null;
        }

        var reactions = Enum.GetValues<TorchReaction>().ToDictionary(item => item.ToString().ToLowerInvariant(), StringComparer.Ordinal);
        if (file.Torch is null || !reactions.TryGetValue(file.Torch, out var torch))
        {
            errors.Add($"{name}: unknown torch reaction '{file.Torch}' (expected curious, shy or calm).");
            return null;
        }

        if (file.Aquatic == true && file.Perched == true)
        {
            errors.Add($"{name}: an animal cannot be both aquatic and perched.");
            return null;
        }

        return new WildlifeTraits(torch, file.Aquatic ?? false, file.Perched ?? false);
    }

    /// <summary>Sourced seasons and optional times of day (all times when absent), as lowercase names.</summary>
    private static Availability? ValidateAvailability(AvailabilityFile? file, string name, HashSet<string> sourceIds, List<string> errors)
    {
        if (file is null)
        {
            errors.Add($"{name}: 'availability' is required.");
            return null;
        }

        var errorCount = errors.Count;
        var seasons = ParseNames<Season>(file.Seasons, $"{name}: availability.seasons", "season", errors);
        var times = file.Times is null ? Enum.GetValues<TimeOfDay>().ToHashSet() : ParseNames<TimeOfDay>(file.Times, $"{name}: availability.times", "time of day", errors);
        var weather = file.AlsoInWeather is null ? null : ParseNames<Weather>(file.AlsoInWeather, $"{name}: availability.alsoInWeather", "weather", errors);

        if (file.Sources is null || file.Sources.Count == 0)
        {
            errors.Add($"{name}: availability has no sources.");
        }
        else if (file.Sources.Where(id => !sourceIds.Contains(id)).ToList() is { Count: > 0 } unknown)
        {
            errors.Add($"{name}: availability references unknown source(s): {string.Join(", ", unknown)}.");
        }

        return errors.Count > errorCount ? null : new Availability(seasons, times, file.Sources!, weather);
    }

    /// <summary>A non-empty set of enum values written as lowercase names (e.g. <c>spring</c>, <c>night</c>).</summary>
    private static HashSet<T> ParseNames<T>(List<string>? names, string at, string kind, List<string> errors)
        where T : struct, Enum
    {
        var result = new HashSet<T>();
        if (names is null || names.Count == 0)
        {
            errors.Add($"{at} must list at least one {kind}.");
            return result;
        }

        var byName = Enum.GetValues<T>().ToDictionary(item => item.ToString().ToLowerInvariant(), StringComparer.Ordinal);
        foreach (var value in names)
        {
            if (value is null || !byName.TryGetValue(value, out var parsed))
            {
                errors.Add($"{at}: unknown {kind} '{value}'.");
            }
            else
            {
                result.Add(parsed);
            }
        }

        return result;
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

    /// <summary>
    /// Every ID needs a PNG of exactly <paramref name="width"/>×<paramref name="height"/> named after it (species pictures,
    /// walk sprites, NPC sprites); only the signature and IHDR header are read.
    /// </summary>
    private static void ValidateImages(string folder, string publicFolder, IEnumerable<string> ids, string owner, string what, int width, int height, List<string> errors)
    {
        foreach (var id in ids.Order(StringComparer.Ordinal))
        {
            var name = $"{publicFolder}/{id}.png";
            var file = Path.Combine(folder, $"{id}.png");
            if (!File.Exists(file))
            {
                errors.Add($"{name}: {owner} '{id}' has no {what}.");
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
                errors.Add($"{name}: the {what} of {owner} '{id}' is not a PNG.");
                continue;
            }

            var actualWidth = BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(16, 4));
            var actualHeight = BinaryPrimitives.ReadInt32BigEndian(header.AsSpan(20, 4));
            if (actualWidth != width || actualHeight != height)
            {
                errors.Add($"{name}: the {what} of {owner} '{id}' must be {width}×{height} pixels (found {actualWidth}×{actualHeight}).");
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

    private static (Dictionary<(string, string), MapSpot> Spots, Dictionary<string, List<MapZone>> Zones, Dictionary<(string, string), MapNpc> Npcs, List<StationPlacement> Stations) LoadMaps(string folder, Dictionary<SpeciesId, Species> species, Dictionary<string, Habitat> habitats, IReadOnlySet<string> areas, Dictionary<string, Npc> npcs, IReadOnlySet<string> rewardFlags, List<string> errors)
    {
        var result = new Dictionary<(string, string), MapSpot>();
        var zones = new Dictionary<string, List<MapZone>>(StringComparer.Ordinal);
        var mapNpcs = new Dictionary<(string, string), MapNpc>();
        var stations = new List<StationPlacement>();
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

                zones[mapId] = ValidateZones(map, name, "habitat", "habitatId", habitats.Keys.ToHashSet(StringComparer.Ordinal), errors);
                ValidateAreaCoverage(map, name, ValidateZones(map, name, "area", "areaId", areas, errors), errors);
                foreach (var placed in ValidateMapActors(map, mapId, name, npcs, rewardFlags, errors))
                {
                    mapNpcs[(mapId, placed.Npc.Id)] = placed;
                }

                stations.AddRange(StationPlacementsOf(map, mapId, name));
            }
        }

        return (result, zones, mapNpcs, stations);
    }

    /// <summary>
    /// Zones of one kind (<c>habitat</c> or <c>area</c>): rectangles of that class naming a known ID in
    /// <paramref name="property"/>; a tile belongs to a zone if its centre is inside. Zones of a kind must not overlap.
    /// </summary>
    private static List<MapZone> ValidateZones(TiledMapFile map, string name, string kind, string property, IReadOnlySet<string> known, List<string> errors)
    {
        var result = new List<MapZone>();
        var objects = map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects ?? [];
        foreach (var zone in objects.Where(o => o.ObjectClass == kind))
        {
            var id = zone.StringProperty(property);
            var at = $"{name}: {kind} zone '{zone.Name ?? id}'";
            if (id is null || !known.Contains(id))
            {
                errors.Add($"{at} refers to unknown {kind} '{id}'.");
                continue;
            }

            // An area may be marked underground (dark at any time of day on the client).
            if (kind == "area" && zone.Properties?.FirstOrDefault(p => p.Name == "underground") is { } underground
                && underground.Value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            {
                errors.Add($"{at}: 'underground' must be a boolean.");
            }

            // Tile x is covered when its centre (16x + 8) lies in [X, X + Width).
            const double HalfTile = TileSize / 2.0;
            var tiles = new MapZone(
                id,
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
                errors.Add($"{at} overlaps another {kind} zone.");
            }
            else
            {
                result.Add(tiles);
            }
        }

        return result;
    }

    /// <summary>Every walkable tile (collision 0) must lie in an area, so the player always has a location.</summary>
    private static void ValidateAreaCoverage(TiledMapFile map, string name, List<MapZone> areas, List<string> errors)
    {
        var collision = map.Layers?.FirstOrDefault(l => l.Name == "collision" && l.Type == "tilelayer")?.Data;
        if (collision is null || collision.Count != map.Width * map.Height)
        {
            return; // reported by the map validation
        }

        var uncovered = Enumerable.Range(0, collision.Count)
            .Where(i => collision[i] == 0)
            .Select(i => (X: i % map.Width, Y: i / map.Width))
            .Where(tile => !areas.Any(area => area.Contains(tile.X, tile.Y)))
            .ToList();
        if (uncovered.Count > 0)
        {
            errors.Add($"{name}: {uncovered.Count} walkable tile(s) lie in no area, e.g. ({uncovered[0].X}, {uncovered[0].Y}).");
        }
    }

    private static HashSet<string> LoadAreas(string folder, List<string> errors)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"{AreasFolder}/{Path.GetFileName(file)}";
            var area = Read<AreaFile>(file, name, errors);
            if (area is null)
            {
                continue;
            }

            var errorCount = errors.Count;
            if (area.Id is null || !MapIdPattern().IsMatch(area.Id))
            {
                errors.Add($"{name}: invalid area ID '{area.Id}' (expected lowercase snake_case).");
            }

            foreach (var (language, text) in area.Text ?? [])
            {
                if (string.IsNullOrWhiteSpace(text?.Name))
                {
                    errors.Add($"{name}: 'text.{language}.name' is missing.");
                }
            }

            if (area.Text is null || !area.Text.ContainsKey(IContentCatalog.DefaultLanguage))
            {
                errors.Add($"{name}: Slovenian name ('text.{IContentCatalog.DefaultLanguage}.name') is required.");
            }

            if (errors.Count == errorCount && !result.Add(area.Id!))
            {
                errors.Add($"{name}: duplicate area ID '{area.Id}'.");
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

        foreach (var tileset in map.Tilesets ?? [])
        {
            foreach (var tile in tileset.Tiles ?? [])
            {
                foreach (var frame in tile.Animation ?? [])
                {
                    if (frame.Tileid < 0 || frame.Tileid >= tileset.Tilecount || frame.Duration <= 0)
                    {
                        errors.Add($"{name}: the animation of tile {tile.Id} needs frames inside the tileset with a positive duration.");
                        break;
                    }
                }
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
