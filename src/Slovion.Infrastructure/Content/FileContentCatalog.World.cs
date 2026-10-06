using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.WorldGeneration;

namespace Slovion.Infrastructure.Content;

/// <summary>A map as content: its JSON as served, its authored spots and habitat zones, and the template when it is generated.</summary>
internal sealed record MapContent(string MapId, byte[] Json, IReadOnlyList<MapSpot> Spots, IReadOnlyList<MapZone> Habitats, MapTemplate? Template);

/// <summary>Everything templates and generated maps are checked against.</summary>
internal sealed record WorldContent(Dictionary<SpeciesId, Species> Species, Dictionary<string, Habitat> Habitats, Dictionary<string, Biome> Biomes, Dictionary<SpeciesId, PlacementFile> Placements, IReadOnlySet<string> Areas);

/// <summary>
/// Biomes, templates and generated maps (docs/decisions.md D13). A template is a map with rectangles of class
/// <c>generated</c> (each naming its <c>biome</c>, <c>areaId</c>, optional <c>underground</c> and the comma-separated
/// <c>species</c> it holds) and optional <c>connector</c> points on their edges; everything else in it is authored.
/// </summary>
public sealed partial class FileContentCatalog
{
    /// <summary>Seeds every template is generated with at startup, so content that cannot be generated fails early.</summary>
    private const int StartupSeeds = 4;

    private const string TilesetsUrl = "/content/tilesets/";

    /// <summary>The map as served to clients for this save, generated when it is a template.</summary>
    internal MapContent? FindMap(string mapId) => maps.GetValueOrDefault(mapId);

    /// <summary>An authored map as every save sees it.</summary>
    internal static SaveMap Authored(MapContent map)
    {
        ArgumentNullException.ThrowIfNull(map);
        var json = ServedJson(map.Json);
        return new SaveMap(map.MapId, map.Spots, map.Habitats.Select(ToHabitatZone).ToList(), json, EntityTag(json), null);
    }

    /// <summary>A template's map for a world seed and generation version.</summary>
    /// <exception cref="InvalidOperationException">The generated map is invalid (a content error caught at startup).</exception>
    internal SaveMap Generate(MapContent map, long seed, int version)
    {
        ArgumentNullException.ThrowIfNull(map);
        var template = map.Template ?? throw new ArgumentException($"{map.MapId} is not a template.", nameof(map));
        var generated = WorldGenerator.Generate(template, biomes, seed, version);
        var json = ServedJson(map.Json, generated, template);
        var parsed = JsonSerializer.Deserialize<TiledMapFile>(json, JsonOptions)!;
        var errors = new List<string>();
        var world = new WorldContent(species, habitats, biomes, [], areaIds);
        var (spots, habitatZones) = ReadLayout(parsed, map.MapId, $"generated {map.MapId} (seed {seed})", world, errors);
        if (errors.Count > 0)
        {
            throw new InvalidOperationException(string.Join(" ", errors));
        }

        var details = new WorldDetails(seed, version, template.Areas.Select(area => area.BiomeId).Distinct().ToList());
        return new SaveMap(map.MapId, spots, habitatZones.Select(ToHabitatZone).ToList(), json, EntityTag(json), details);
    }

    private void ValidateGeneration(List<string> errors)
    {
        foreach (var map in maps.Values.Where(map => map.Template is not null))
        {
            for (var seed = 0; seed < StartupSeeds; seed++)
            {
                try
                {
                    Generate(map, seed, WorldGenerator.Version);
                }
                catch (InvalidOperationException exception)
                {
                    errors.Add($"maps/{map.MapId}.json: generation with seed {seed} failed: {exception.Message}");
                    break;
                }
            }
        }
    }

    private static MapHabitatZone ToHabitatZone(MapZone zone) => new(zone.Id, zone.MinX, zone.MinY, zone.MaxX, zone.MaxY);

    private static string EntityTag(byte[] json) => $"\"{SeedHash.Of(Convert.ToBase64String(json)):x16}\"";

    private static Dictionary<string, Biome> LoadBiomes(string folder, Dictionary<string, Habitat> habitats, List<string> errors)
    {
        var result = new Dictionary<string, Biome>(StringComparer.Ordinal);
        foreach (var file in JsonFiles(folder))
        {
            var name = $"biomes/{Path.GetFileName(file)}";
            var biome = Read<BiomeFile>(file, name, errors);
            if (biome is not null && ValidateBiome(biome, name, habitats, errors) is { } valid && !result.TryAdd(valid.Id, valid))
            {
                errors.Add($"{name}: duplicate biome ID '{valid.Id}'.");
            }
        }

        return result;
    }

    private static Biome? ValidateBiome(BiomeFile file, string name, Dictionary<string, Habitat> habitats, List<string> errors)
    {
        var errorCount = errors.Count;
        if (file.Id is null || !MapIdPattern().IsMatch(file.Id))
        {
            errors.Add($"{name}: invalid biome ID '{file.Id}' (expected lowercase snake_case).");
        }

        if (file.Floor is not { Count: > 0 })
        {
            errors.Add($"{name}: 'floor' tiles are required.");
        }

        var layers = new List<TerrainLayer>();
        foreach (var layer in file.Layers ?? [])
        {
            var bias = layer.Bias is null ? null : ParseEdge(layer.Bias);
            if (layer.Id is null || layer.Coverage is < 0 or > 1 || layer.Scale < 1 || layer.Smooth < 0
                || (layer.Bias is not null && bias is null) || layer.BiasStrength is < 0 or > 1)
            {
                errors.Add($"{name}: layer '{layer.Id}' needs an ID, a coverage from 0 to 1, a scale of at least 1, smoothing of 0 or more, and optionally a bias edge (north, east, south or west) with a strength from 0 to 1.");
                continue;
            }

            layers.Add(new TerrainLayer(layer.Id, layer.Coverage, layer.Scale, layer.Smooth, layer.Floor, layer.Blocking, bias, layer.BiasStrength));
        }

        var layerIds = layers.Select(layer => layer.Id).ToHashSet(StringComparer.Ordinal);
        CellSelector? Selector(string? text, string at)
        {
            var selector = CellSelector.Parse(text);
            if (selector is null)
            {
                errors.Add($"{name}: {at} has an invalid selector '{text}'.");
            }
            else if (selector.Layer is { } layer && !layerIds.Contains(layer))
            {
                errors.Add($"{name}: {at} refers to unknown layer '{layer}'.");
                return null;
            }

            return selector;
        }

        Openings? openings = null;
        if (file.Openings is { } open)
        {
            if (open.Count is not [var minCount, var maxCount] || open.Radius is not [var minRadius, var maxRadius]
                || minCount < 0 || maxCount < minCount || minRadius < 1 || maxRadius < minRadius || open.Floor is not { Count: > 0 })
            {
                errors.Add($"{name}: 'openings' needs 'count' and 'radius' ranges ([min, max]) and 'floor' tiles.");
            }
            else
            {
                openings = new Openings(minCount, maxCount, minRadius, maxRadius, open.Floor, open.PathSet);
            }
        }

        Water? water = null;
        if (file.Water is { } spec)
        {
            var edge = spec.Edge is null ? Edge.South : ParseEdge(spec.Edge);
            if (!Enum.TryParse<WaterKind>(spec.Kind, ignoreCase: true, out var kind) || !Enum.IsDefined(kind) || spec.Chance is < 0 or > 1 || spec.Size < 1
                || spec.Tiles is not { Count: > 0 } || edge is null || spec.ShallowWidth < 0 || (spec.ShallowWidth > 0 && spec.Shallow is not { Count: > 0 }))
            {
                errors.Add($"{name}: 'water' needs a kind (stream, pond or shore), a chance from 0 to 1, a size of at least 1 and tiles; a shore names its edge, and shallows need tiles.");
            }
            else
            {
                water = new Water(kind, spec.Chance, spec.Size, spec.Tiles, spec.Bank, edge.Value, spec.Shallow, spec.ShallowWidth);
            }
        }

        var decor = new List<DecorRule>();
        foreach (var (rule, i) in (file.Decor ?? []).Select((rule, i) => (rule, i)))
        {
            if (rule.Tiles is not { Count: > 0 } || rule.Density is < 0 or > 1)
            {
                errors.Add($"{name}: decor rule {i} needs tiles and a density from 0 to 1.");
            }
            else if (Selector(rule.Where, $"decor rule {i}") is { } where)
            {
                decor.Add(new DecorRule(rule.Tiles, rule.Blocking, rule.Density, where));
            }
        }

        var zones = new List<ZoneRule>();
        foreach (var zone in file.Zones ?? [])
        {
            if (zone.Kind is null || !MapIdPattern().IsMatch(zone.Kind))
            {
                errors.Add($"{name}: a zone kind must be lowercase snake_case (found '{zone.Kind}').");
            }
            else if (zone.Habitat is not null && !habitats.ContainsKey(zone.Habitat))
            {
                errors.Add($"{name}: zone '{zone.Kind}' refers to unknown habitat '{zone.Habitat}'.");
            }
            else if (Selector(zone.Where, $"zone '{zone.Kind}'") is { } where)
            {
                zones.Add(new ZoneRule(zone.Kind, where, zone.Habitat));
            }
        }

        return errors.Count > errorCount
            ? null
            : new Biome(file.Id!, file.Floor!, file.PathSet, file.Border ?? [], layers, openings, water, decor, zones);
    }

    private static Edge? ParseEdge(string text) => Enum.TryParse<Edge>(text, ignoreCase: true, out var edge) && Enum.IsDefined(edge) ? edge : null;

    /// <summary>The template of a map with <c>generated</c> rectangles, or <c>null</c> for an authored map.</summary>
    private static MapTemplate? BuildTemplate(TiledMapFile map, string mapId, string name, WorldContent world, List<string> errors)
    {
        var objects = map.Layers?.FirstOrDefault(l => l.Name == "objects" && l.Type == "objectgroup")?.Objects ?? [];
        var generated = objects.Where(o => o.ObjectClass == "generated").ToList();
        if (generated.Count == 0)
        {
            return null;
        }

        var errorCount = errors.Count;
        var cells = map.Width * map.Height;
        var tileCount = map.Tilesets?.FirstOrDefault()?.Tilecount ?? 0;
        var layer = (string layerName) => map.Layers?.FirstOrDefault(l => l.Name == layerName && l.Type == "tilelayer")?.Data;
        if (layer("ground") is not { } ground || layer("decor") is not { } decor || layer("collision") is not { } collision
            || ground.Count != cells || decor.Count != cells || collision.Count != cells || !collision.Any(gid => gid != 0))
        {
            errors.Add($"{name}: a template needs 'ground', 'decor' and 'collision' layers of the map's size, and some collision.");
            return null;
        }

        var tileAt = (TiledObjectFile o) => new GridPoint((int)Math.Floor((o.X + (o.Width / 2)) / TileSize), (int)Math.Floor((o.Y - (o.Height / 2)) / TileSize));
        var pointAt = (TiledObjectFile o) => new GridPoint((int)Math.Floor(o.X / TileSize), (int)Math.Floor(o.Y / TileSize));
        var connectors = objects.Where(o => o.ObjectClass == "connector").Select(pointAt).ToList();
        var areas = new List<GenerationArea>();
        foreach (var rectangle in generated)
        {
            var at = $"{name}: generated area '{rectangle.Name}'";
            var rect = new GridRect((int)Math.Round(rectangle.X / TileSize), (int)Math.Round(rectangle.Y / TileSize), (int)Math.Round(rectangle.Width / TileSize), (int)Math.Round(rectangle.Height / TileSize));
            if (rect.Width < 1 || rect.Height < 1 || rect.X < 0 || rect.Y < 0 || rect.Right >= map.Width || rect.Bottom >= map.Height)
            {
                errors.Add($"{at} must cover tiles inside the map.");
                continue;
            }

            var biomeId = rectangle.StringProperty("biome");
            var areaId = rectangle.StringProperty("areaId");
            if (biomeId is null || !world.Biomes.TryGetValue(biomeId, out var biome))
            {
                errors.Add($"{at} refers to unknown biome '{biomeId}'.");
                continue;
            }

            if (areaId is null || !world.Areas.Contains(areaId))
            {
                errors.Add($"{at} refers to unknown area '{areaId}'.");
            }

            ValidateBiomeTiles(biome, tileCount, at, errors);
            var requests = new List<SpeciesRequest>();
            foreach (var speciesId in (rectangle.StringProperty("species") ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (ResolvePlacement(speciesId, biome, world, tileCount, $"{at}: species '{speciesId}'", errors) is { } placement)
                {
                    requests.Add(new SpeciesRequest(speciesId, placement));
                }
            }

            var inside = connectors.Where(rect.Contains).ToList();
            foreach (var connector in inside.Where(connector => !rect.OnEdge(connector)))
            {
                errors.Add($"{at}: connector ({connector.X}, {connector.Y}) must lie on the area's edge.");
            }

            foreach (var authored in objects.Where(o => o.ObjectClass is not ("generated" or "connector" or "area")))
            {
                var tile = authored.Gid > 0 ? tileAt(authored) : pointAt(authored);
                if (rect.Contains(tile))
                {
                    errors.Add($"{at} contains authored {authored.ObjectClass} '{authored.Name}'; authored objects must lie outside generated areas.");
                }
            }

            areas.Add(new GenerationArea(rect, biomeId, areaId ?? string.Empty, rectangle.BoolProperty("underground") ?? false, requests, inside));
        }

        foreach (var area in objects.Where(o => o.ObjectClass == "area"))
        {
            // Tiles whose centre lies inside the zone, as in ValidateZones.
            const double HalfTile = TileSize / 2.0;
            var minX = (int)Math.Ceiling((area.X - HalfTile) / TileSize);
            var minY = (int)Math.Ceiling((area.Y - HalfTile) / TileSize);
            var maxX = (int)Math.Ceiling((area.X + area.Width - HalfTile) / TileSize) - 1;
            var maxY = (int)Math.Ceiling((area.Y + area.Height - HalfTile) / TileSize) - 1;
            if (areas.Any(generatedArea => minX <= generatedArea.Rect.Right && generatedArea.Rect.X <= maxX && minY <= generatedArea.Rect.Bottom && generatedArea.Rect.Y <= maxY))
            {
                errors.Add($"{name}: area zone '{area.Name}' overlaps a generated area, which brings its own area zone.");
            }
        }

        var spawn = objects.FirstOrDefault(o => o.ObjectClass == "spawn");
        if (spawn is null || errors.Count > errorCount)
        {
            return null;
        }

        var pathTiles = world.Biomes.Values
            .SelectMany(biome => new[] { biome.PathSet, biome.Openings?.PathSet })
            .OfType<int>()
            .SelectMany(set => Enumerable.Range(set, 16))
            .ToHashSet();
        var wadeable = (map.Tilesets?.FirstOrDefault()?.Tiles ?? []).Where(tile => tile.IsFlagged("wadeable")).Select(tile => tile.Id).ToHashSet();
        var blockingObjects = objects.Where(o => o.ObjectClass is "npc" or "signpost" or "station" or "gate" or "lamp").Select(tileAt).ToList();
        return new MapTemplate(
            mapId,
            map.Width,
            map.Height,
            ground.Select(gid => gid - 1).ToList(),
            decor.Select(gid => gid - 1).ToList(),
            collision.Select(gid => gid != 0).ToList(),
            pathTiles,
            pointAt(spawn),
            blockingObjects,
            areas,
            wadeable);
    }

    private static void ValidateBiomeTiles(Biome biome, int tileCount, string at, List<string> errors)
    {
        var tiles = biome.Floor.Concat(biome.Border)
            .Concat(biome.Layers.SelectMany(layer => layer.Floor ?? []))
            .Concat(biome.Openings?.Floor ?? [])
            .Concat(biome.Water?.Tiles ?? []).Concat(biome.Water?.Bank ?? []).Concat(biome.Water?.Shallow ?? [])
            .Concat(biome.Decor.SelectMany(rule => rule.Tiles))
            .Concat(new[] { biome.PathSet, biome.Openings?.PathSet }.OfType<int>().SelectMany(set => new[] { set, set + 15 }));
        if (tiles.FirstOrDefault(tile => tile < 0 || tile >= tileCount, -1) is var bad and >= 0)
        {
            errors.Add($"{at}: biome '{biome.Id}' uses tile {bad}, outside the tileset ({tileCount} tiles).");
        }
    }

    /// <summary>
    /// Where a species may live in a biome: its placement zones, or else every zone kind whose habitat lists it; aquatic
    /// animals live in water and perched ones on a perch; a plant needs the tile drawn at its spot (design §7).
    /// </summary>
    private static SpeciesPlacement? ResolvePlacement(string speciesId, Biome biome, WorldContent world, int tileCount, string at, List<string> errors)
    {
        if (!SpeciesId.IsValid(speciesId) || !world.Species.TryGetValue(SpeciesId.Parse(speciesId), out var species))
        {
            errors.Add($"{at} is unknown.");
            return null;
        }

        var file = world.Placements.GetValueOrDefault(species.Id);
        var kinds = biome.Zones.Select(zone => zone.Kind).ToHashSet(StringComparer.Ordinal);
        var zones = file?.Zones is { Count: > 0 } listed
            ? listed.Where(kinds.Contains).ToList()
            : biome.Zones.Where(zone => zone.HabitatId is { } habitat && world.Habitats[habitat].Species.Any(entry => entry.SpeciesId == species.Id))
                .Select(zone => zone.Kind).Distinct().ToList();
        if (zones.Count == 0)
        {
            errors.Add($"{at} cannot live in biome '{biome.Id}': none of its zone kinds fits its placement or habitats.");
            return null;
        }

        var water = file?.Water switch
        {
            "in" => WaterNeed.In,
            "near" => WaterNeed.Near,
            "wade" => WaterNeed.Wade,
            null when species.Wildlife?.Aquatic == true => WaterNeed.In,
            null => WaterNeed.None,
            _ => (WaterNeed?)null,
        };
        if (water is null)
        {
            errors.Add($"{at}: placement 'water' must be 'in', 'near' or 'wade' (found '{file?.Water}').");
            return null;
        }

        if (species.Group == SpeciesGroup.Plant && file?.Tile is not { } tile)
        {
            errors.Add($"{at}: a plant needs a placement 'tile' (the decoration drawn at its spot).");
            return null;
        }

        if (file?.Tile is { } drawn && (drawn < 0 || drawn >= tileCount))
        {
            errors.Add($"{at}: placement tile {drawn} lies outside the tileset.");
            return null;
        }

        return new SpeciesPlacement(zones, water.Value, species.Wildlife?.Perched ?? false, file?.Tile, file?.Blocking ?? false);
    }

    /// <summary>A map's JSON as served: the tileset image addressed absolutely (maps are served from the API).</summary>
    private static byte[] ServedJson(byte[] source, GeneratedMap? generated = null, MapTemplate? template = null)
    {
        var root = JsonNode.Parse(source)!.AsObject();
        foreach (var tileset in root["tilesets"]?.AsArray() ?? [])
        {
            if (tileset?["image"]?.GetValue<string>() is { } image)
            {
                tileset["image"] = TilesetsUrl + Path.GetFileName(image);
            }
        }

        if (generated is not null && template is not null)
        {
            WriteGenerated(root, generated, template);
        }

        return JsonSerializer.SerializeToUtf8Bytes(root);
    }

    /// <summary>Writes the generated tiles and objects into the template's JSON (gids are tile + the tileset's first gid).</summary>
    private static void WriteGenerated(JsonObject root, GeneratedMap generated, MapTemplate template)
    {
        var firstGid = root["tilesets"]?[0]?["firstgid"]?.GetValue<int>() ?? 1;
        var layers = root["layers"]!.AsArray();
        var collisionGid = layers.First(l => l?["name"]?.GetValue<string>() == "collision")!["data"]!.AsArray()
            .Select(node => node!.GetValue<int>()).First(gid => gid != 0);
        foreach (var layer in layers)
        {
            var data = layer?["name"]?.GetValue<string>() switch
            {
                "ground" => generated.Ground.Select(tile => tile < 0 ? 0 : tile + firstGid),
                "decor" => generated.Decor.Select(tile => tile < 0 ? 0 : tile + firstGid),
                "collision" => generated.Blocked.Select(blocked => blocked ? collisionGid : 0),
                _ => null,
            };
            if (data is not null)
            {
                layer!["data"] = new JsonArray(data.Select(value => (JsonNode)value).ToArray());
            }
        }

        var objectLayer = layers.First(l => l?["type"]?.GetValue<string>() == "objectgroup")!;
        var objects = objectLayer["objects"]!.AsArray();
        foreach (var authoredOnly in objects.Where(o => o?["type"]?.GetValue<string>() is "generated" or "connector").ToList())
        {
            objects.Remove(authoredOnly);
        }

        var nextId = objects.Select(o => o?["id"]?.GetValue<int>() ?? 0).DefaultIfEmpty(0).Max() + 1;
        static JsonObject Property(string name, JsonNode value, string type = "string") => new() { ["name"] = name, ["type"] = type, ["value"] = value };
        foreach (var spot in generated.Spots)
        {
            var spotId = string.Create(CultureInfo.InvariantCulture, $"{template.MapId}_{spot.SpeciesId}_1");
            objects.Add(new JsonObject
            {
                ["id"] = nextId++,
                ["name"] = spotId,
                ["type"] = "spot",
                ["point"] = true,
                ["x"] = (spot.At.X * TileSize) + (TileSize / 2),
                ["y"] = (spot.At.Y * TileSize) + (TileSize / 2),
                ["width"] = 0,
                ["height"] = 0,
                ["rotation"] = 0,
                ["visible"] = true,
                ["properties"] = new JsonArray(Property("speciesId", spot.SpeciesId), Property("spotId", spotId)),
            });
        }

        foreach (var (zone, kind) in generated.HabitatZones.Select(zone => (zone, "habitat")).Concat(generated.AreaZones.Select(zone => (zone, "area"))))
        {
            var properties = kind == "habitat"
                ? new JsonArray(Property("habitatId", zone.Id))
                : new JsonArray(Property("areaId", zone.Id), Property("underground", zone.Underground, "bool"));
            objects.Add(new JsonObject
            {
                ["id"] = nextId,
                ["name"] = string.Create(CultureInfo.InvariantCulture, $"generated_{kind}_{nextId++}"),
                ["type"] = kind,
                ["x"] = zone.Rect.X * TileSize,
                ["y"] = zone.Rect.Y * TileSize,
                ["width"] = zone.Rect.Width * TileSize,
                ["height"] = zone.Rect.Height * TileSize,
                ["rotation"] = 0,
                ["visible"] = true,
                ["properties"] = properties,
            });
        }

        root["nextobjectid"] = nextId;
    }
}
