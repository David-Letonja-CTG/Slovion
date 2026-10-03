using System.Text.Json.Nodes;
using Slovion.Domain.Content;
using Slovion.Domain.World;
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

        // The hedgerow strip south of the meadow: zones beside the track; the track and the hedge are not.
        Assert.Equal("hedgerow", catalog.FindHabitatAt("dravsko_polje_meadow", 2, 20)?.Id);
        Assert.Equal("hedgerow", catalog.FindHabitatAt("dravsko_polje_meadow", 13, 22)?.Id);
        Assert.Equal("hedgerow", catalog.FindHabitatAt("dravsko_polje_meadow", 29, 22)?.Id);
        Assert.Equal("hedgerow", catalog.FindHabitatAt("dravsko_polje_meadow", 5, 26)?.Id);
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 20, 21));
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 10, 23));
        Assert.Null(catalog.FindHabitatAt("dravsko_polje_meadow", 20, 19));
        Assert.Equal(SpeciesId.Parse("crataegus_monogyna"), catalog.FindSpot("dravsko_polje_meadow", "hedgerow_hawthorn_1")?.SpeciesId);

        // Vera stands on the meadow and gives the first quest, whose flag opens the hedgerow gate.
        Assert.Equal("Vera", catalog.FindNpcOnMap("dravsko_polje_meadow", "vera")?.Npc.Names["sl"]);
        var quest = catalog.FindQuestByGiver("vera");
        Assert.NotNull(quest);
        Assert.Equal(("eye_for_nature", 3, "hedgerow_open"), (quest.Id, quest.IdentifiedSpeciesGoal, quest.RewardFlag));
        Assert.Equal("Oko za naravo", quest.Text["sl"].Title);
        Assert.Null(catalog.FindNpcOnMap("other_map", "vera"));

        Assert.Equal(["tall_grass", "hedgerow"], catalog.AllHabitats.Select(habitat => habitat.Id));
        Assert.Equal(["Visoka trava", "Mejica"], catalog.AllHabitats.Select(habitat => habitat.Names["sl"]));
        Assert.Equal([1, 2], catalog.AllHabitats.Select(habitat => habitat.Order));
    }

    [Theory]
    [InlineData("alauda_arvensis", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter })]
    [InlineData("lepus_europaeus", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter })]
    [InlineData("taraxacum_officinale", new[] { Season.Spring, Season.Autumn })]
    [InlineData("salvia_pratensis", new[] { Season.Spring, Season.Summer })]
    [InlineData("crataegus_monogyna", new[] { Season.Spring, Season.Summer })]
    [InlineData("papilio_machaon", new[] { Season.Spring, Season.Summer, Season.Autumn })]
    [InlineData("lanius_collurio", new[] { Season.Spring, Season.Summer, Season.Autumn })]
    public void Repository_species_have_their_sourced_availability(string id, Season[] seasons)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var availability = catalog.FindSpecies(SpeciesId.Parse(id))!.Availability;

        Assert.Equal(seasons.Order(), availability.Seasons.Order());
        Assert.Equal(Enum.GetValues<TimeOfDay>().Order(), availability.Times.Order()); // no sourced time-of-day limits yet
        Assert.NotEmpty(availability.SourceIds);
    }

    [Theory]
    [InlineData("crataegus_monogyna", SpeciesGroup.Plant, "enovrati glog")]
    [InlineData("lanius_collurio", SpeciesGroup.Bird, "rjavi srakoper")]
    public void Repository_content_has_the_hedgerow_species(string id, SpeciesGroup group, string slName)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal(group, species.Group);
        Assert.Equal(slName, species.Text["sl"].Name.Value);
        Assert.Equal(3, species.Clues.Count);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == "hedgerow").Species, entry => entry.SpeciesId == species.Id);
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
        { "missing availability", c => c.Species.Remove("availability"), "'availability' is required" },
        { "unknown season", c => c.Species["availability"]!["seasons"] = new JsonArray("spring", "monsoon"), "availability.seasons: unknown season 'monsoon'" },
        { "no seasons", c => c.Species["availability"]!["seasons"] = new JsonArray(), "availability.seasons must list at least one season" },
        { "unknown time of day", c => c.Species["availability"]!["times"] = new JsonArray("midnight"), "availability.times: unknown time of day 'midnight'" },
        { "capitalized season", c => c.Species["availability"]!["seasons"] = new JsonArray("Spring"), "unknown season 'Spring'" },
        { "unsourced availability", c => c.Species["availability"]!.AsObject().Remove("sources"), "availability has no sources" },
        { "availability with an unknown source", c => c.Species["availability"]!["sources"] = new JsonArray("nope"), "availability references unknown source(s): nope" },
        { "missing picture", c => c.Picture = null, "species 'salvia_pratensis' has no picture" },
        { "picture of the wrong size", c => c.Picture = ContentFolder.Png(64, 64), "must be 32×32 pixels (found 64×64)" },
        { "picture that is not a PNG", c => c.Picture = "GIF89a not a png at all"u8.ToArray(), "picture of species 'salvia_pratensis' is not a PNG" },
        { "habitat without Slovenian name", c => c.Habitat.Remove("text"), "Slovenian name ('text.sl.name') is required" },
        { "habitat without order", c => c.Habitat.Remove("order"), "'order' must be a positive integer (found none)" },
        { "non-positive habitat order", c => c.Habitat["order"] = 0, "'order' must be a positive integer (found 0)" },
        { "blank habitat name", c => c.Habitat["text"]!["sl"]!["name"] = " ", "'text.sl.name' is missing" },
        { "quest from an unknown NPC", c => c.Quest["giver"] = "mojca", "quest 'eye_for_nature' is given by unknown NPC 'mojca'" },
        { "quest without a goal", c => c.Quest["goal"]!["identifiedSpecies"] = 0, "'goal.identifiedSpecies' must be a positive integer" },
        { "quest without a reward flag", c => c.Quest["reward"]!["flag"] = "Hedgerow-Open", "'reward.flag' must be a lowercase snake_case flag ID" },
        { "quest without Slovenian text", c => c.Quest["text"] = new JsonObject(), "Slovenian text ('text.sl') is required" },
        { "missing dialogue state", c => QuestSl(c)["dialogue"]!.AsObject().Remove("ready"), "text.sl.dialogue.ready needs at least one line" },
        { "empty dialogue line", c => QuestSl(c)["dialogue"]!["completed"] = new JsonArray(" "), "text.sl.dialogue.completed needs at least one line and no empty lines" },
        { "unknown placeholder", c => QuestSl(c)["dialogue"]!["active"] = new JsonArray("Živijo, {name}!"), "uses unknown placeholder '{name}'" },
        { "quest without a title", c => QuestSl(c).Remove("title"), "text.sl.title is missing" },
        { "NPC without a Slovenian name", c => c.Npc.Remove("text"), "Slovenian name ('text.sl.name') is required" },
        { "NPC without a quest", c => c.Quest["giver"] = "mojca", "NPC 'vera' must give exactly one quest (found 0)" },
        { "map NPC that does not exist", c => Objects(c).Add(ContentFolder.TileObject("npc", "npcId", "mojca")), "refers to unknown NPC 'mojca'" },
        { "map NPC that is not a tile object", c => Objects(c).Add(ContentFolder.TileObject("npc", "npcId", "vera", gid: 0)), "must be a tile object" },
        { "map NPC outside the map", c => Objects(c).Add(ContentFolder.TileObject("npc", "npcId", "vera", tileX: 9)), "npc 'vera' lies outside the map" },
        { "gate whose flag no quest rewards", c => Objects(c).Add(ContentFolder.TileObject("gate", "requiresFlag", "secret_path")), "requires flag 'secret_path', which no quest rewards" },
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
    public void Species_in_no_habitat_are_rejected()
    {
        using var content = new ContentFolder();
        content.Write();
        content.Species["id"] = "vulpes_vulpes";

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write(speciesFile: "vulpes_vulpes.json")));

        Assert.Contains(error.Errors, message => message.Contains("species 'vulpes_vulpes' is not listed in any habitat", StringComparison.Ordinal));
        Assert.DoesNotContain(error.Errors, message => message.Contains("salvia_pratensis", StringComparison.Ordinal));
    }

    [Fact]
    public void Valid_fixture_places_an_NPC_and_a_gate()
    {
        using var content = new ContentFolder();
        Objects(content).Add(ContentFolder.TileObject("npc", "npcId", "vera"));
        Objects(content).Add(ContentFolder.TileObject("gate", "requiresFlag", "hedgerow_open", tileY: 2));

        var catalog = FileContentCatalog.Load(content.Write());

        Assert.NotNull(catalog.FindNpcOnMap("test_meadow", "vera"));
        Assert.Equal("eye_for_nature", catalog.FindQuest("eye_for_nature")?.Id);
    }

    [Fact]
    public void Duplicate_quest_IDs_are_rejected()
    {
        using var content = new ContentFolder();
        content.Write();

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write(questFile: "copy.json")));

        Assert.Contains(error.Errors, message => message.Contains("duplicate quest ID 'eye_for_nature'", StringComparison.Ordinal));
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

    private static JsonObject QuestSl(ContentFolder content) => content.Quest["text"]!["sl"]!.AsObject();

    private static JsonArray Objects(ContentFolder content) => content.Map["layers"]![2]!["objects"]!.AsArray();
}
