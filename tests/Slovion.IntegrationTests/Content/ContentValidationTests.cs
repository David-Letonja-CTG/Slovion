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
        Assert.Equal(["binoculars"], quest.RewardItems);
        Assert.Equal("Oko za naravo", quest.Text["sl"].Title);
        Assert.Null(catalog.FindNpcOnMap("other_map", "vera"));

        Assert.Equal(["tall_grass", "hedgerow", "fir_beech_forest", "mountain_forest", "alpine_grassland", "wetland"], catalog.AllHabitats.Select(habitat => habitat.Id));
        Assert.Equal([60, 60, 50, 55], catalog.AllHabitats.Skip(2).Select(habitat => habitat.SearchChancePercent));
        Assert.Equal(["Visoka trava", "Mejica", "Jelovo-bukov gozd", "Gorski gozd", "Visokogorje", "Mokrišče"], catalog.AllHabitats.Select(habitat => habitat.Names["sl"]));
        Assert.Equal([1, 2, 3, 4, 5, 6], catalog.AllHabitats.Select(habitat => habitat.Order));
    }

    [Fact]
    public void Repository_content_has_the_regions()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(
            [
                ("dravsko_polje", "dravsko_polje_meadow", (UnlockRule)new UnlockRule.Always()),
                ("kocevje", "kocevje_forest", new UnlockRule.Flag("hedgerow_open")),
                ("pohorje", "pohorje_forest", new UnlockRule.Flag("pohorje_open")),
                ("triglav", "triglav_alps", new UnlockRule.Flag("triglav_open")),
                ("cerknica", "cerknica_lake", new UnlockRule.Flag("alps_explored")),
            ],
            catalog.AllRegions.Select(region => (region.Id, region.MapId, region.Unlock)));
        Assert.Equal(["Dravsko polje", "Kočevje", "Pohorje", "Triglav", "Cerkniško jezero"], catalog.AllRegions.Select(region => region.Text["sl"].Name));
    }

    [Theory]
    [InlineData("ursus_arctos", "rjavi medved", "kocevje_forest", "kocevje_bear_1", "fir_beech_forest", TorchReaction.Shy)]
    [InlineData("canis_lupus", "volk", "pohorje_forest", "pohorje_wolf_1", "mountain_forest", TorchReaction.Shy)]
    [InlineData("rupicapra_rupicapra", "gams", "triglav_alps", "triglav_chamois_1", "alpine_grassland", TorchReaction.Calm)]
    public void Repository_content_has_the_signature_species_of_the_regions(string id, string slName, string mapId, string spotId, string habitatId, TorchReaction torch)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal(SpeciesGroup.Mammal, species.Group);
        Assert.Equal(slName, species.Text["sl"].Name.Value);
        Assert.Equal(3, species.Clues.Count);
        Assert.Equal(torch, species.Wildlife?.Torch);
        Assert.Equal(species.Id, catalog.FindSpot(mapId, spotId)?.SpeciesId);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == habitatId).Species, entry => entry.SpeciesId == species.Id);
    }

    [Fact]
    public void Repository_content_has_the_field_tools()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(
            [("lamp", true, "svetilka"), ("binoculars", false, "daljnogled"), ("boots", false, "škornji"), ("magnifier", false, "povečevalno steklo")],
            catalog.AllItems.Select(item => (item.Id, item.IsStart, item.Text["sl"].Name)).OrderBy(item => item.Item1 == "lamp" ? 0 : 1).ThenBy(item => item.Item1, StringComparer.Ordinal));
        Assert.Equal(["binoculars"], catalog.FindQuest("eye_for_nature")!.RewardItems);
        Assert.Equal(["magnifier"], catalog.FindQuest("in_the_shade_of_firs")!.RewardItems);
        Assert.Equal(["boots"], catalog.FindQuest("secrets_of_the_bog")!.RewardItems);
        Assert.Null(catalog.FindQuest("below_the_peaks")!.RewardItems);
    }

    [Fact]
    public void Repository_regions_have_weather_with_snow_only_in_winter_except_on_triglav()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        foreach (var region in catalog.AllRegions)
        {
            Assert.NotNull(region.WeatherWeights);
            Assert.Equal(Enum.GetValues<Season>().Order(), region.WeatherWeights.Keys.Order());
            var snowySeasons = region.WeatherWeights.Where(pair => pair.Value.ContainsKey(Weather.Snow)).Select(pair => pair.Key).Order();
            Assert.Equal(region.Id == "triglav" ? [Season.Spring, Season.Autumn, Season.Winter] : [Season.Winter], snowySeasons);
        }
    }

    [Theory]
    [InlineData("salamandra_salamandra", "navadni močerad", "kocevje_forest", "kocevje_salamander_1", "fir_beech_forest")]
    [InlineData("salamandra_atra", "planinski močerad", "triglav_alps", "triglav_salamander_1", "alpine_grassland")]
    public void Repository_content_has_the_salamanders(string id, string slName, string mapId, string spotId, string habitatId)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal((SpeciesGroup.Amphibian, slName, 3), (species.Group, species.Text["sl"].Name.Value, species.Clues.Count));
        Assert.Equal(TorchReaction.Calm, species.Wildlife?.Torch);
        Assert.Equal([Weather.Rain], species.Availability.AlsoInWeather!.Order());
        Assert.DoesNotContain(TimeOfDay.Day, species.Availability.Times);
        Assert.Equal(species.Id, catalog.FindSpot(mapId, spotId)?.SpeciesId);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == habitatId).Species, entry => entry.SpeciesId == species.Id);
    }

    [Theory]
    [InlineData("jure", "Jure", "kocevje_forest", "in_the_shade_of_firs", "fir_beech_forest", "pohorje_open")]
    [InlineData("maja", "Maja", "pohorje_forest", "secrets_of_the_bog", "mountain_forest", "triglav_open")]
    [InlineData("luka", "Luka", "triglav_alps", "below_the_peaks", "alpine_grassland", "alps_explored")]
    [InlineData("neza", "Neža", "cerknica_lake", "vanishing_lake", "wetland", "lake_explored")]
    public void Repository_content_has_the_people_of_the_regions(string npcId, string name, string mapId, string questId, string habitatId, string flag)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(name, catalog.FindNpcOnMap(mapId, npcId)?.Npc.Names["sl"]);
        var quest = catalog.FindQuestByGiver(npcId);
        Assert.NotNull(quest);
        Assert.Equal((questId, 3, habitatId, flag), (quest.Id, quest.IdentifiedSpeciesGoal, quest.GoalHabitatId, quest.RewardFlag));
        Assert.Null(catalog.FindHabitatAt(mapId, 3, 10));
    }

    [Theory]
    [InlineData("cervus_elaphus", SpeciesGroup.Mammal, "navadni jelen", "fir_beech_forest")]
    [InlineData("allium_ursinum", SpeciesGroup.Plant, "čemaž", "fir_beech_forest")]
    [InlineData("galium_odoratum", SpeciesGroup.Plant, "dišeča lakota", "fir_beech_forest")]
    [InlineData("abies_alba", SpeciesGroup.Plant, "navadna jelka", "fir_beech_forest")]
    [InlineData("fagus_sylvatica", SpeciesGroup.Plant, "navadna bukev", "fir_beech_forest")]
    [InlineData("sciurus_vulgaris", SpeciesGroup.Mammal, "navadna veverica", "mountain_forest")]
    [InlineData("drosera_rotundifolia", SpeciesGroup.Plant, "okroglolistna rosika", "mountain_forest")]
    [InlineData("vaccinium_myrtillus", SpeciesGroup.Plant, "navadna borovnica", "mountain_forest")]
    [InlineData("picea_abies", SpeciesGroup.Plant, "navadna smreka", "mountain_forest")]
    [InlineData("marmota_marmota", SpeciesGroup.Mammal, "alpski svizec", "alpine_grassland")]
    [InlineData("leontopodium_nivale", SpeciesGroup.Plant, "planika", "alpine_grassland")]
    [InlineData("potentilla_nitida", SpeciesGroup.Plant, "triglavska roža", "alpine_grassland")]
    [InlineData("pinus_mugo", SpeciesGroup.Plant, "rušje", "alpine_grassland")]
    [InlineData("ardea_cinerea", SpeciesGroup.Bird, "siva čaplja", "wetland")]
    [InlineData("crex_crex", SpeciesGroup.Bird, "kosec", "wetland")]
    [InlineData("hyla_arborea", SpeciesGroup.Amphibian, "zelena rega", "wetland")]
    [InlineData("calopteryx_splendens", SpeciesGroup.Insect, "pasasti bleščavec", "wetland")]
    [InlineData("iris_pseudacorus", SpeciesGroup.Plant, "vodna perunika", "wetland")]
    [InlineData("iris_sibirica", SpeciesGroup.Plant, "sibirska perunika", "wetland")]
    [InlineData("nymphaea_alba", SpeciesGroup.Plant, "beli lokvanj", "wetland")]
    public void Repository_content_has_more_species_of_the_regions(string id, SpeciesGroup group, string slName, string habitatId)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal(group, species.Group);
        Assert.Equal(slName, species.Text["sl"].Name.Value);
        Assert.Equal(3, species.Clues.Count);
        Assert.Equal(group != SpeciesGroup.Plant, species.Wildlife is not null);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == habitatId).Species, entry => entry.SpeciesId == species.Id);
    }

    [Theory]
    [InlineData("kocevje_forest", "fir_beech_forest", new[] { "kocevje_garlic_1", "kocevje_woodruff_1", "kocevje_deer_1" })]
    [InlineData("pohorje_forest", "mountain_forest", new[] { "pohorje_sundew_1", "pohorje_bilberry_1", "pohorje_squirrel_1" })]
    [InlineData("triglav_alps", "alpine_grassland", new[] { "triglav_edelweiss_1", "triglav_rose_1", "triglav_marmot_1" })]
    [InlineData("cerknica_lake", "wetland", new[] { "cerknica_heron_1", "cerknica_corncrake_1", "cerknica_frog_1", "cerknica_demoiselle_1", "cerknica_yellow_iris_1", "cerknica_siberian_iris_1", "cerknica_water_lily_1" })]
    public void Region_maps_have_habitat_zones_and_spots(string mapId, string habitatId, string[] spotIds)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        // The spawn (1, 9), the tile beside it and the signpost (2, 8) lie outside the zones; ground further away does not.
        Assert.Null(catalog.FindHabitatAt(mapId, 1, 9));
        Assert.Null(catalog.FindHabitatAt(mapId, 2, 9));
        Assert.Null(catalog.FindHabitatAt(mapId, 2, 8));
        Assert.Equal(habitatId, catalog.FindHabitatAt(mapId, 5, 16)?.Id);
        Assert.All(spotIds, spotId => Assert.NotNull(catalog.FindSpot(mapId, spotId)));
    }

    [Fact]
    public void The_corncrake_lives_in_the_wet_meadow_of_the_lake()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var spot = catalog.FindSpot("cerknica_lake", "cerknica_corncrake_1");
        Assert.Equal(SpeciesId.Parse("crex_crex"), spot?.SpeciesId);
        Assert.Equal("wetland", catalog.FindHabitatAt("cerknica_lake", 14, 5)?.Id);
        Assert.Equal("wetland", catalog.FindHabitatAt("cerknica_lake", 5, 12)?.Id);
    }

    [Theory]
    [InlineData("cervus_elaphus", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("sciurus_vulgaris", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening })]
    [InlineData("marmota_marmota", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening })]
    [InlineData("allium_ursinum", new[] { Season.Spring }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("drosera_rotundifolia", new[] { Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("leontopodium_nivale", new[] { Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("pinus_mugo", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("ursus_arctos", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("canis_lupus", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("rupicapra_rupicapra", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening })]
    [InlineData("ardea_cinerea", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("crex_crex", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("hyla_arborea", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("calopteryx_splendens", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("iris_pseudacorus", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("iris_sibirica", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("nymphaea_alba", new[] { Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    public void Region_species_have_their_sourced_availability(string id, Season[] seasons, TimeOfDay[] times)
    {
        var availability = FileContentCatalog.Load(ContentFolder.RepositoryContent()).FindSpecies(SpeciesId.Parse(id))!.Availability;

        Assert.Equal(seasons.Order(), availability.Seasons.Order());
        Assert.Equal(times.Order(), availability.Times.Order());
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
        Assert.Equal(Enum.GetValues<TimeOfDay>().Order(), availability.Times.Order()); // no sourced time-of-day limits for the lowland species
        Assert.NotEmpty(availability.SourceIds);
    }

    [Theory]
    [InlineData("lepus_europaeus", TorchReaction.Curious)]
    [InlineData("lanius_collurio", TorchReaction.Shy)]
    [InlineData("alauda_arvensis", TorchReaction.Calm)]
    [InlineData("papilio_machaon", TorchReaction.Calm)]
    public void Repository_animals_have_their_torch_reaction(string id, TorchReaction torch)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(torch, catalog.FindSpecies(SpeciesId.Parse(id))!.Wildlife?.Torch);
        Assert.Null(catalog.FindSpecies(SpeciesId.Parse("salvia_pratensis"))!.Wildlife);
        Assert.Equal(SpeciesId.Parse("lanius_collurio"), catalog.FindSpot("dravsko_polje_meadow", "hedgerow_shrike_1")?.SpeciesId);
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
        { "quest goal in an unknown habitat", c => c.Quest["goal"]!["habitat"] = "swamp", "'goal.habitat' must be a habitat listing at least 3 species (found 'swamp')" },
        { "quest goal habitat too small", c => c.Quest["goal"]!["habitat"] = "tall_grass", "'goal.habitat' must be a habitat listing at least 3 species (found 'tall_grass')" },
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
        { "area without a Slovenian name", c => c.Area.Remove("text"), "areas/test_field.json: Slovenian name ('text.sl.name') is required" },
        { "invalid area ID", c => c.Area["id"] = "Test-Field", "invalid area ID 'Test-Field'" },
        { "zone naming a missing area", c => Objects(c).Add(ContentFolder.AreaZone("swamp", 0, 0, "extra")), "area zone 'extra' refers to unknown area 'swamp'" },
        { "overlapping area zones", c => Objects(c).Add(ContentFolder.AreaZone(name: "copy")), "area zone 'copy' overlaps another area zone" },
        { "area zone beyond the map", c => Objects(c).Add(ContentFolder.AreaZone(fromX: 4, toX: 5, name: "outside")), "area zone 'outside' extends beyond the map" },
        { "walkable tiles without an area", c => Objects(c)[3] = ContentFolder.AreaZone(fromX: 0, toX: 1), "6 walkable tile(s) lie in no area, e.g. (2, 0)" },
        { "animal without wildlife traits", c => c.Species["group"] = "mammal", "'wildlife' traits are required for animals" },
        { "plant with wildlife traits", c => c.Species["wildlife"] = new JsonObject { ["torch"] = "calm" }, "plants must not declare 'wildlife' traits" },
        { "unknown torch reaction", c => { c.Species["group"] = "mammal"; c.Species["wildlife"] = new JsonObject { ["torch"] = "brave" }; }, "unknown torch reaction 'brave'" },
        { "animal without a walk sprite", c => { c.Species["group"] = "mammal"; c.Species["wildlife"] = new JsonObject { ["torch"] = "shy" }; c.WildlifeSprite = null; }, "species 'salvia_pratensis' has no walk sprite" },
        { "walk sprite of the wrong size", c => { c.Species["group"] = "mammal"; c.Species["wildlife"] = new JsonObject { ["torch"] = "shy" }; c.WildlifeSprite = ContentFolder.Png(16, 16); }, "walk sprite of species 'salvia_pratensis' must be 32×16 pixels (found 16×16)" },
        { "NPC without a sprite", c => c.NpcSprite = null, "NPC 'vera' has no sprite" },
        { "tile animation outside the tileset", c => c.Map["tilesets"] = new JsonArray(new JsonObject { ["tilecount"] = 8, ["tiles"] = new JsonArray(new JsonObject { ["id"] = 1, ["animation"] = new JsonArray(new JsonObject { ["tileid"] = 9, ["duration"] = 100 }) }) }), "the animation of tile 1 needs frames inside the tileset" },
        { "map without a signpost", c => Objects(c).RemoveAt(4), "exactly one 'signpost' object is required (found 0)" },
        { "map with two signposts", c => Objects(c).Add(ContentFolder.TileObject("signpost", "note", "second", tileX: 0, tileY: 0)), "exactly one 'signpost' object is required (found 2)" },
        { "signpost outside the map", c => Objects(c)[4] = ContentFolder.TileObject("signpost", "note", "far", tileX: 9), "signpost 'far' lies outside the map" },
        { "region on an unknown map", c => c.Region["mapId"] = "nowhere", "region 'dravsko_polje' refers to unknown map 'nowhere'" },
        { "map in no region", c => c.Region["mapId"] = "nowhere", "map 'test_meadow' must belong to exactly one region (found 0)" },
        { "region with an unrewarded flag", c => c.Region["unlock"] = new JsonObject { ["flag"] = "secret" }, "region 'dravsko_polje' requires flag 'secret', which no quest rewards" },
        { "region with a non-positive count", c => c.Region["unlock"] = new JsonObject { ["identifiedSpecies"] = 0 }, "'unlock.identifiedSpecies' must be a positive integer (found 0)" },
        { "region with two rules", c => c.Region["unlock"] = new JsonObject { ["flag"] = "hedgerow_open", ["identifiedSpecies"] = 2 }, "may name a flag or a number of identified species, not both" },
        { "region without Slovenian text", c => c.Region["text"] = new JsonObject(), "regions/dravsko_polje.json: Slovenian text ('text.sl') is required" },
        { "region without a hint", c => c.Region["text"]!["sl"]!.AsObject().Remove("lockedHint"), "'text.sl' needs a 'name' and a 'lockedHint'" },
        { "region outside the travel map", c => c.Region["position"]!["x"] = 101, "'position.x' and 'position.y' must be between 0 and 100" },
        { "region without an order", c => c.Region.Remove("order"), "regions/dravsko_polje.json: 'order' must be a positive integer (found none)" },
        { "invalid region ID", c => c.Region["id"] = "Dravsko-Polje", "invalid region ID 'Dravsko-Polje'" },
        { "no start region", c => c.Region["id"] = "elsewhere", "the start region 'dravsko_polje' is required" },
        { "region without weather", c => c.Region.Remove("weather"), "'weather.spring' needs weights for one or more weather kinds" },
        { "region missing a season's weather", c => c.Region["weather"]!.AsObject().Remove("winter"), "'weather.winter' needs weights" },
        { "region with unknown weather", c => c.Region["weather"]!["spring"]!["hail"] = 1, "'weather.spring' has unknown weather 'hail'" },
        { "region with a non-positive weather weight", c => c.Region["weather"]!["summer"]!["clear"] = 0, "'weather.summer.clear' must be a positive weight (found 0)" },
        { "region with an unknown weather season", c => c.Region["weather"]!["monsoon"] = new JsonObject { ["rain"] = 1 }, "'weather' has unknown season 'monsoon'" },
        { "species with unknown weather", c => c.Species["availability"]!["alsoInWeather"] = new JsonArray("hail"), "availability.alsoInWeather: unknown weather 'hail'" },
        { "species with empty weather", c => c.Species["availability"]!["alsoInWeather"] = new JsonArray(), "availability.alsoInWeather must list at least one weather" },
        { "tool without Slovenian text", c => c.Item["text"] = new JsonObject(), "items/lamp.json: Slovenian text ('text.sl') is required" },
        { "tool without a description", c => c.Item["text"]!["sl"]!.AsObject().Remove("description"), "'text.sl' needs a 'name' and a 'description'" },
        { "tool without an icon", c => c.ItemIcon = null, "tool 'lamp' has no icon" },
        { "tool icon of the wrong size", c => c.ItemIcon = ContentFolder.Png(32, 32), "icon of tool 'lamp' must be 16×16 pixels (found 32×32)" },
        { "quest rewarding an unknown tool", c => c.Quest["reward"]!["items"] = new JsonArray("compass"), "quest 'eye_for_nature' rewards unknown tool 'compass'" },
        { "tool nobody can get", c => c.Item["start"] = false, "tool 'lamp' is neither a start tool nor any quest's reward" },
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
    public void Duplicate_region_IDs_are_rejected()
    {
        using var content = new ContentFolder();
        content.Write();

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(content.Write(regionFile: "copy.json")));

        Assert.Contains(error.Errors, message => message.Contains("duplicate region ID 'dravsko_polje'", StringComparison.Ordinal));
    }

    [Fact]
    public void Valid_fixture_has_its_region()
    {
        using var content = new ContentFolder();

        var catalog = FileContentCatalog.Load(content.Write());

        var region = Assert.Single(catalog.AllRegions);
        Assert.Equal(("dravsko_polje", "test_meadow", 78, 34), (region.Id, region.MapId, region.X, region.Y));
        Assert.IsType<UnlockRule.Always>(region.Unlock);
        Assert.Equal(new Dictionary<Weather, int> { [Weather.Clear] = 3, [Weather.Rain] = 1 }, region.WeatherWeights![Season.Spring]);
        Assert.Same(region, catalog.FindRegionOfMap("test_meadow"));
        Assert.Null(catalog.FindRegionOfMap("other_map"));
        Assert.Same(region, catalog.FindRegion("dravsko_polje"));
        Assert.Null(catalog.FindRegion("atlantis"));
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
