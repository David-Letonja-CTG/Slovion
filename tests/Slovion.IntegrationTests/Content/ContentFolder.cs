using System.Text.Json.Nodes;

namespace Slovion.IntegrationTests.Content;

/// <summary>A temporary content folder that starts valid and can be broken one detail at a time.</summary>
public sealed class ContentFolder : IDisposable
{
    public string Path { get; }

    public JsonObject Species { get; }

    public JsonObject Map { get; }

    public JsonObject Habitat { get; }

    public JsonObject Npc { get; }

    public JsonObject Area { get; }

    public JsonObject Quest { get; }

    public JsonObject Region { get; }

    /// <summary>The picture written for the species; <c>null</c> writes none.</summary>
    public byte[]? Picture { get; set; } = Png(32, 32);

    /// <summary>The walk sprite written for the species (used when it is an animal); <c>null</c> writes none.</summary>
    public byte[]? WildlifeSprite { get; set; } = Png(32, 16);

    /// <summary>The sprite sheet written for the NPC; <c>null</c> writes none.</summary>
    public byte[]? NpcSprite { get; set; } = Png(32, 64);

    public ContentFolder()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "slovion-content-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "species"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "maps"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "habitats"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "species-pictures"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "npcs"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "areas"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "wildlife-sprites"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "npc-sprites"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "quests"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "regions"));
        Species = ValidSpecies();
        Map = ValidMap();
        Habitat = ValidHabitat();
        Npc = ValidNpc();
        Area = new JsonObject { ["id"] = "test_field", ["text"] = new JsonObject { ["sl"] = new JsonObject { ["name"] = "Testno polje" } } };
        Quest = ValidQuest();
        Region = ValidRegion();
    }

    /// <summary>Writes the species, its picture, the map, the habitat, the NPC, the quest and the region, and returns the folder path.</summary>
    public string Write(string speciesFile = "salvia_pratensis.json", string mapFile = "test_meadow.json", string habitatFile = "tall_grass.json", string npcFile = "vera.json", string questFile = "eye_for_nature.json", string regionFile = "dravsko_polje.json")
    {
        File.WriteAllText(System.IO.Path.Combine(Path, "regions", regionFile), Region.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "npcs", npcFile), Npc.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "areas", "test_field.json"), Area.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "quests", questFile), Quest.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "species", speciesFile), Species.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "maps", mapFile), Map.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "habitats", habitatFile), Habitat.ToJsonString());
        if (WildlifeSprite is not null)
        {
            File.WriteAllBytes(System.IO.Path.Combine(Path, "wildlife-sprites", $"{Species["id"]}.png"), WildlifeSprite);
        }

        if (NpcSprite is not null)
        {
            File.WriteAllBytes(System.IO.Path.Combine(Path, "npc-sprites", $"{Npc["id"]}.png"), NpcSprite);
        }

        if (Picture is not null)
        {
            File.WriteAllBytes(System.IO.Path.Combine(Path, "species-pictures", $"{Species["id"]}.png"), Picture);
        }

        return Path;
    }

    public void Dispose() => Directory.Delete(Path, recursive: true);

    public static string RepositoryContent()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(System.IO.Path.Combine(directory.FullName, "Slovion.slnx")))
        {
            directory = directory.Parent;
        }

        return System.IO.Path.Combine(
            directory?.FullName ?? throw new InvalidOperationException("Repository root not found."),
            "content");
    }

    /// <summary>The start of a PNG of the given size: signature and IHDR chunk, all that validation reads.</summary>
    public static byte[] Png(int width, int height)
    {
        byte[] png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, .. "IHDR"u8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 6, 0, 0, 0, 0, 0, 0, 0];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(16), width);
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(png.AsSpan(20), height);
        return png;
    }

    private static JsonObject Fact(string value, params string[] sources) =>
        new() { ["value"] = value, ["sources"] = new JsonArray(sources.Select(s => (JsonNode)s).ToArray()) };

    private static JsonObject ValidSpecies() => new()
    {
        ["id"] = "salvia_pratensis",
        ["group"] = "plant",
        ["scientificName"] = Fact("Salvia pratensis L.", "src"),
        ["sources"] = new JsonObject
        {
            ["src"] = new JsonObject
            {
                ["title"] = "Test source",
                ["publisher"] = "Test publisher",
                ["url"] = "https://example.org/salvia",
                ["accessed"] = "2026-10-02",
                ["licence"] = "CC BY 4.0",
            },
        },
        ["text"] = new JsonObject
        {
            ["sl"] = new JsonObject
            {
                ["name"] = Fact("travniška kadulja", "src"),
                ["family"] = Fact("ustnatice", "src"),
                ["habitat"] = Fact("Suhi travniki.", "src"),
                ["distribution"] = Fact("Pogosta.", "src"),
                ["season"] = Fact("Maj–avgust.", "src"),
                ["characteristics"] = new JsonArray(
                    Fact("Štirirobo steblo.", "src"),
                    Fact("Modri cvetovi.", "src"),
                    Fact("Listna rozeta.", "src")),
            },
        },
        ["availability"] = new JsonObject { ["seasons"] = new JsonArray("spring", "summer"), ["sources"] = new JsonArray("src") },
        ["identification"] = new JsonObject { ["clues"] = new JsonArray(1, 0, 2) },
    };

    private static JsonObject ValidHabitat() => new()
    {
        ["id"] = "tall_grass",
        ["text"] = new JsonObject { ["sl"] = new JsonObject { ["name"] = "Visoka trava" } },
        ["order"] = 1,
        ["searchChancePercent"] = 70,
        ["species"] = new JsonArray(new JsonObject { ["speciesId"] = "salvia_pratensis", ["weight"] = 5 }),
    };

    private static JsonObject ValidRegion() => new()
    {
        ["id"] = "dravsko_polje",
        ["mapId"] = "test_meadow",
        ["order"] = 1,
        ["position"] = new JsonObject { ["x"] = 78, ["y"] = 34 },
        ["unlock"] = new JsonObject(),
        ["text"] = new JsonObject { ["sl"] = new JsonObject { ["name"] = "Dravsko polje", ["lockedHint"] = "Vedno odprto." } },
        ["weather"] = new JsonObject
        {
            ["spring"] = new JsonObject { ["clear"] = 3, ["rain"] = 1 },
            ["summer"] = new JsonObject { ["clear"] = 1 },
            ["autumn"] = new JsonObject { ["fog"] = 1 },
            ["winter"] = new JsonObject { ["snow"] = 1 },
        },
    };

    private static JsonObject ValidNpc() => new()
    {
        ["id"] = "vera",
        ["text"] = new JsonObject { ["sl"] = new JsonObject { ["name"] = "Vera" } },
    };

    private static JsonObject ValidQuest()
    {
        static JsonArray Lines(params string[] lines) => new(lines.Select(line => (JsonNode)line).ToArray());

        return new JsonObject
        {
            ["id"] = "eye_for_nature",
            ["giver"] = "vera",
            ["goal"] = new JsonObject { ["identifiedSpecies"] = 3 },
            ["reward"] = new JsonObject { ["flag"] = "hedgerow_open" },
            ["text"] = new JsonObject
            {
                ["sl"] = new JsonObject
                {
                    ["title"] = "Oko za naravo",
                    ["summary"] = "Prepoznaj tri vrste.",
                    ["returnHint"] = "Vrni se k Veri.",
                    ["dialogue"] = new JsonObject
                    {
                        ["offer"] = Lines("Živijo!"),
                        ["active"] = Lines("Prepoznane vrste: {identified} od {goal}."),
                        ["ready"] = Lines("Odlično!"),
                        ["completed"] = Lines("Kako je pri mejici?"),
                    },
                },
            },
        };
    }

    /// <summary>A Tiled tile object (bottom-left anchored) of class <paramref name="type"/> on tile (<paramref name="tileX"/>, <paramref name="tileY"/>).</summary>
    public static JsonObject TileObject(string type, string property, string value, int tileX = 3, int tileY = 0, int gid = 1) => new()
    {
        ["type"] = type,
        ["name"] = value,
        ["gid"] = gid,
        ["x"] = tileX * 16,
        ["y"] = (tileY + 1) * 16,
        ["width"] = 16,
        ["height"] = 16,
        ["properties"] = new JsonArray(new JsonObject { ["name"] = property, ["type"] = "string", ["value"] = value }),
    };

    /// <summary>An area rectangle covering the whole 4×3 test map, or the given tile columns.</summary>
    public static JsonObject AreaZone(string areaId = "test_field", int fromX = 0, int toX = 3, string name = "field") => new()
    {
        ["type"] = "area",
        ["name"] = name,
        ["x"] = fromX * 16,
        ["y"] = 0,
        ["width"] = (toX - fromX + 1) * 16,
        ["height"] = 48,
        ["properties"] = new JsonArray(new JsonObject { ["name"] = "areaId", ["type"] = "string", ["value"] = areaId }),
    };

    /// <summary>A habitat rectangle covering tiles x 1–2, y 0–2 of the 4×3 test map.</summary>
    public static JsonObject HabitatZone(string habitatId = "tall_grass") => new()
    {
        ["type"] = "habitat",
        ["name"] = "grass",
        ["x"] = 16,
        ["y"] = 0,
        ["width"] = 32,
        ["height"] = 48,
        ["properties"] = new JsonArray(new JsonObject { ["name"] = "habitatId", ["type"] = "string", ["value"] = habitatId }),
    };

    private static JsonObject ValidMap()
    {
        static JsonArray Tiles(int count) => new(Enumerable.Range(0, count).Select(_ => (JsonNode?)JsonValue.Create(0)).ToArray());
        static JsonObject Point(string type, int tileX, int tileY, JsonArray properties) => new()
        {
            ["type"] = type,
            ["x"] = tileX * 16 + 8,
            ["y"] = tileY * 16 + 8,
            ["point"] = true,
            ["properties"] = properties,
        };
        static JsonObject Property(string name, string value) =>
            new() { ["name"] = name, ["type"] = "string", ["value"] = value };

        return new JsonObject
        {
            ["orientation"] = "orthogonal",
            ["width"] = 4,
            ["height"] = 3,
            ["tilewidth"] = 16,
            ["tileheight"] = 16,
            ["layers"] = new JsonArray(
                new JsonObject { ["name"] = "ground", ["type"] = "tilelayer", ["data"] = Tiles(12) },
                new JsonObject { ["name"] = "collision", ["type"] = "tilelayer", ["data"] = Tiles(12) },
                new JsonObject
                {
                    ["name"] = "objects",
                    ["type"] = "objectgroup",
                    ["objects"] = new JsonArray(
                        Point("spawn", 0, 1, new JsonArray(Property("facing", "right"))),
                        Point("spot", 2, 1, new JsonArray(
                            Property("spotId", "sage_1"),
                            Property("speciesId", "salvia_pratensis"))),
                        HabitatZone(),
                        AreaZone(),
                        TileObject("signpost", "note", "signpost", tileX: 3, tileY: 2)),
                }),
        };
    }
}
