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
    }

    [Fact]
    public void Valid_fixture_loads()
    {
        using var content = new ContentFolder();

        var catalog = FileContentCatalog.Load(content.Write());

        Assert.NotNull(catalog.FindSpot("test_meadow", "sage_1"));
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
