using System.Text.Json.Nodes;
using Slovion.Domain.Content;
using Slovion.Infrastructure.Content;

namespace Slovion.IntegrationTests.Content;

public sealed class ContentValidationTests
{
    [Fact]
    public void Repository_content_is_valid()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var sage = catalog.FindSpecies(SpeciesId.Parse("salvia_pratensis"));
        Assert.NotNull(sage);
        Assert.Equal("travniška kadulja", sage.Text["sl"].Name.Value);
        Assert.Equal(sage.Id, catalog.FindSpot("dravsko_polje_meadow", "meadow_sage_1")?.SpeciesId);
        Assert.Contains("sl", catalog.Languages);

        // The tall grass patches south and north of the path are habitat; the path and spawn are not.
        Assert.Equal(70, catalog.FindHabitatAt("dravsko_polje_meadow", 12, 12)?.SearchChancePercent);
        Assert.Equal("tall_grass", catalog.FindHabitatAt("dravsko_polje_meadow", 18, 15)?.Id);
        Assert.Equal("tall_grass", catalog.FindHabitatAt("dravsko_polje_meadow", 8, 3)?.Id);
        Assert.Equal("tall_grass", catalog.FindHabitatAt("dravsko_polje_meadow", 13, 6)?.Id);
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 10, 10));
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 19, 12));
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 12, 11));
    }

    [Fact]
    public void Valid_fixture_loads()
    {
        using var content = new ContentFolder();

        var catalog = FileContentCatalog.Load(content.Write());

        Assert.NotNull(catalog.FindSpot("test_meadow", "sage_1"));
        Assert.Equal("tall_grass", catalog.FindHabitatAt("test_meadow", 1, 0)?.Id);
        Assert.Equal("tall_grass", catalog.FindHabitatAt("test_meadow", 2, 2)?.Id);
        Assert.Null(catalog.FindHabitatAt("test_meadow", 0, 1));
        Assert.Null(catalog.FindHabitatAt("test_meadow", 3, 1));
        Assert.Null(catalog.FindHabitatAt("other_map", 1, 0));
    }

    public static TheoryData<string, Action<ContentFolder>, string> BrokenContent => new()
    {
        { "invalid ID", c => c.Species["id"] = "Salvia-Pratensis", "invalid species ID 'Salvia-Pratensis'" },
        { "unsourced characteristic", c => Sl(c)["characteristics"]![0]!["sources"] = new JsonArray(), "characteristics[0] has no sources" },
        { "unknown source", c => Sl(c)["habitat"]!["sources"] = new JsonArray("nope"), "habitat references unknown source(s): nope" },
        { "missing Slovenian habitat", c => Sl(c).Remove("habitat"), "text.sl.habitat is missing" },
        { "missing Slovenian text", c => c.Species["text"] = new JsonObject(), "Slovenian text ('text.sl') is required" },
        { "source without url", c => c.Species["sources"]!["src"]!.AsObject().Remove("url"), "source 'src' needs an absolute http(s) 'url'" },
        { "map without spawn", c => Objects(c).RemoveAt(0), "exactly one 'spawn' object is required (found 0)" },
        { "map without collision layer", c => c.Map["layers"]!.AsArray().RemoveAt(1), "tile layer 'collision' is required" },
        { "non-orthogonal map", c => c.Map["orientation"] = "isometric", "only orthogonal maps are supported" },
        { "unknown group", c => c.Species["group"] = "fungus", "unknown group 'fungus'" },
        { "clue out of range", c => c.Species["identification"]!["clues"] = new JsonArray(0, 1, 4), "clue 4 has no matching characteristic in text.sl" },
        { "duplicate clues", c => c.Species["identification"]!["clues"] = new JsonArray(0, 1, 1), "must not repeat a characteristic" },
        { "too few clues", c => c.Species["identification"]!["clues"] = new JsonArray(0, 1), "must list exactly 3 characteristics (found 2)" },
        { "no identification", c => c.Species.Remove("identification"), "must list exactly 3 characteristics (found 0)" },
        { "habitat with unknown species", c => c.Habitat["species"]![0]!["speciesId"] = "vulpes_vulpes", "unknown species 'vulpes_vulpes'" },
        { "non-positive weight", c => c.Habitat["species"]![0]!["weight"] = 0, "needs a positive weight (found 0)" },
        { "chance out of range", c => c.Habitat["searchChancePercent"] = 0, "must be between 1 and 100 (found 0)" },
        { "habitat without species", c => c.Habitat["species"] = new JsonArray(), "at least one species is required" },
        { "zone naming a missing habitat", c => Objects(c)[2]!["properties"]![0]!["value"] = "swamp", "refers to unknown habitat 'swamp'" },
        { "overlapping zones", c => Objects(c).Add(ContentFolder.HabitatZone()), "overlaps another habitat zone" },
        { "spot with unknown species", c => Objects(c)[1]!["properties"]![1]!["value"] = "vulpes_vulpes", "spot 'sage_1' references unknown species 'vulpes_vulpes'" },
    };

    [Theory]
    [MemberData(nameof(BrokenContent))]
    public void Broken_content_is_rejected_with_a_named_error(string _, Action<ContentFolder> breakIt, string expectedError)
    {
        using var content = new ContentFolder();
        breakIt(content);

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write()));

        Assert.Contains(error.Errors, message => message.Contains(expectedError, StringComparison.Ordinal));
    }

    [Fact]
    public void Duplicate_species_IDs_are_rejected()
    {
        using var content = new ContentFolder();
        content.Write();

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write(speciesFile: "copy.json")));

        Assert.Contains(error.Errors, message => message.Contains("duplicate species ID 'salvia_pratensis'", StringComparison.Ordinal));
    }

    [Fact]
    public void Duplicate_habitat_IDs_are_rejected()
    {
        using var content = new ContentFolder();
        content.Write();

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write(habitatFile: "copy.json")));

        Assert.Contains(error.Errors, message => message.Contains("duplicate habitat ID 'tall_grass'", StringComparison.Ordinal));
    }

    [Fact]
    public void All_problems_are_reported_together()
    {
        using var content = new ContentFolder();
        Sl(content).Remove("habitat");
        content.Map["orientation"] = "isometric";

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write()));

        Assert.True(error.Errors.Count >= 2, string.Join(Environment.NewLine, error.Errors));
    }

    private static JsonObject Sl(ContentFolder content) => content.Species["text"]!["sl"]!.AsObject();

    private static JsonArray Objects(ContentFolder content) => content.Map["layers"]![2]!["objects"]!.AsArray();
}
