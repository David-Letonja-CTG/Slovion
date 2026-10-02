using System.Text.Json.Nodes;

namespace Slovion.IntegrationTests.Content;

/// <summary>A temporary content folder that starts valid and can be broken one detail at a time.</summary>
public sealed class ContentFolder : IDisposable
{
    public ContentFolder()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "slovion-content-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "species"));
        Directory.CreateDirectory(System.IO.Path.Combine(Path, "maps"));
        Species = ValidSpecies();
        Map = ValidMap();
    }

    public string Path { get; }

    public JsonObject Species { get; }

    public JsonObject Map { get; }

    /// <summary>Writes the species and map documents and returns the folder path.</summary>
    public string Write(string speciesFile = "salvia_pratensis.json", string mapFile = "test_meadow.json")
    {
        File.WriteAllText(System.IO.Path.Combine(Path, "species", speciesFile), Species.ToJsonString());
        File.WriteAllText(System.IO.Path.Combine(Path, "maps", mapFile), Map.ToJsonString());
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
        ["identification"] = new JsonObject { ["clues"] = new JsonArray(1, 0, 2) },
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
                            Property("speciesId", "salvia_pratensis")))),
                }),
        };
    }
}
