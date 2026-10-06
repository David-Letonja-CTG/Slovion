using System.Text.Json.Nodes;
using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;
using Slovion.Infrastructure.Content;

namespace Slovion.IntegrationTests.Content;

public sealed class ContentValidationTests
{
    /// <summary>A map as a save with <paramref name="seed"/> sees it (authored maps are the same for every seed).</summary>
    private static SaveMap? Map(FileContentCatalog catalog, string mapId, long seed = 0) =>
        new WorldMaps(catalog).Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, seed), mapId);

    private static Habitat? HabitatAt(FileContentCatalog catalog, string mapId, int x, int y) =>
        Map(catalog, mapId)?.HabitatAt(x, y) is { } habitatId ? catalog.FindHabitat(habitatId) : null;

    private static MapSpot? SpotOn(FileContentCatalog catalog, string mapId, string spotId) => Map(catalog, mapId)?.FindSpot(spotId);

    [Fact]
    public void Repository_content_is_valid()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var sage = catalog.FindSpecies(SpeciesId.Parse("salvia_pratensis"));
        Assert.NotNull(sage);
        Assert.Equal("travniška kadulja", sage.Text["sl"].Name.Value);
        Assert.Equal(sage.Id, SpotOn(catalog, "dravsko_polje_meadow", "dravsko_polje_meadow_salvia_pratensis_1")?.SpeciesId);
        Assert.Contains("sl", catalog.Languages);

        // The generated meadow (D13): patches of tall grass are habitat, the rest of the meadow and the spawn's
        // surroundings (the authored path with Vera, the signpost and the station) are not.
        var meadow = Map(catalog, "dravsko_polje_meadow")!;
        Assert.Equal(70, catalog.FindHabitat("tall_grass")?.SearchChancePercent);
        Assert.Contains(meadow.Habitats, zone => zone.HabitatId == "tall_grass" && zone.MaxY < 19);
        Assert.All(new[] { (10, 10), (12, 11), (7, 10), (14, 9) }, tile => Assert.Null(HabitatAt(catalog, "dravsko_polje_meadow", tile.Item1, tile.Item2)));

        // The hedgerow strip behind the hedge (rows 20–26) is hedgerow habitat; the hedge row (19) is not.
        Assert.Contains(meadow.Habitats, zone => zone.HabitatId == "hedgerow");
        Assert.All(meadow.Habitats.Where(zone => zone.HabitatId == "hedgerow"), zone => Assert.InRange(zone.MinY, 20, 26));
        Assert.Equal(SpeciesId.Parse("crataegus_monogyna"), SpotOn(catalog, "dravsko_polje_meadow", "dravsko_polje_meadow_crataegus_monogyna_1")?.SpeciesId);

        // Vera stands on the meadow and gives the first quest, whose flag opens the hedgerow gate.
        Assert.Equal("Vera", catalog.FindNpcOnMap("dravsko_polje_meadow", "vera")?.Npc.Names["sl"]);
        var quest = catalog.FindQuestByGiver("vera");
        Assert.NotNull(quest);
        Assert.Equal(("eye_for_nature", 3, "hedgerow_open"), (quest.Id, quest.IdentifiedSpeciesGoal, quest.RewardFlag));
        Assert.Equal(["binoculars"], quest.RewardItems);
        Assert.Equal("Oko za naravo", quest.Text["sl"].Title);
        Assert.Null(catalog.FindNpcOnMap("other_map", "vera"));

        Assert.Equal(["tall_grass", "hedgerow", "fir_beech_forest", "mountain_forest", "alpine_grassland", "wetland", "karst", "city", "farmland", "saltpan", "sea"], catalog.AllHabitats.Select(habitat => habitat.Id));
        Assert.Equal([60, 60, 50, 55, 50, 50, 55, 55, 50], catalog.AllHabitats.Skip(2).Select(habitat => habitat.SearchChancePercent));
        Assert.Equal(["Visoka trava", "Mejica", "Jelovo-bukov gozd", "Gorski gozd", "Visokogorje", "Mokrišče", "Kras", "Mesto", "Kulturna krajina", "Soline", "Morje"], catalog.AllHabitats.Select(habitat => habitat.Names["sl"]));
        Assert.Equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], catalog.AllHabitats.Select(habitat => habitat.Order));
    }

    [Fact]
    public void Every_region_map_has_a_soundscape_in_the_client()
    {
        var content = ContentFolder.RepositoryContent();
        var catalog = FileContentCatalog.Load(content);
        var soundscapesFile = Path.Combine(content, "..", "client", "public", "audio", "soundscapes.json");
        var soundscapes = JsonNode.Parse(File.ReadAllText(soundscapesFile))!.AsObject();

        Assert.All(catalog.AllRegions, region => Assert.True(soundscapes.ContainsKey(region.MapId), $"region '{region.Id}' (map '{region.MapId}') has no soundscape in client/public/audio/soundscapes.json"));
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
                ("rakov_skocjan", "rakov_skocjan_karst", new UnlockRule.Flag("lake_explored")),
                ("ljubljana", "ljubljana_park", new UnlockRule.Flag("caves_explored")),
                ("murska_sobota", "murska_sobota_village", new UnlockRule.Flag("city_explored")),
                ("portoroz", "portoroz_coast", new UnlockRule.Flag("farmland_explored")),
            ],
            catalog.AllRegions.Select(region => (region.Id, region.MapId, region.Unlock)));
        Assert.Equal(["Dravsko polje", "Kočevje", "Pohorje", "Triglav", "Cerkniško jezero", "Rakov Škocjan", "Ljubljana", "Murska Sobota", "Portorož"], catalog.AllRegions.Select(region => region.Text["sl"].Name));
    }

    [Theory]
    [InlineData("ursus_arctos", "rjavi medved", "kocevje_forest", "kocevje_forest_ursus_arctos_1", "fir_beech_forest", TorchReaction.Shy)]
    [InlineData("canis_lupus", "volk", "pohorje_forest", "pohorje_forest_canis_lupus_1", "mountain_forest", TorchReaction.Shy)]
    [InlineData("rupicapra_rupicapra", "gams", "triglav_alps", "triglav_alps_rupicapra_rupicapra_1", "alpine_grassland", TorchReaction.Calm)]
    public void Repository_content_has_the_signature_species_of_the_regions(string id, string slName, string mapId, string spotId, string habitatId, TorchReaction torch)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal(SpeciesGroup.Mammal, species.Group);
        Assert.Equal(slName, species.Text["sl"].Name.Value);
        Assert.Equal(3, species.Clues.Count);
        Assert.Equal(torch, species.Wildlife?.Torch);
        Assert.Equal(species.Id, SpotOn(catalog, mapId, spotId)?.SpeciesId);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == habitatId).Species, entry => entry.SpeciesId == species.Id);
    }

    [Fact]
    public void Repository_content_has_the_field_tools()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(
            [("lamp", true, "svetilka"), ("binoculars", false, "daljnogled"), ("boots", false, "škornji"), ("magnifier", false, "povečevalno steklo"), ("snorkel", false, "maska z dihalko")],
            catalog.AllItems.Select(item => (item.Id, item.IsStart, item.Text["sl"].Name)).OrderBy(item => item.Item1 == "lamp" ? 0 : 1).ThenBy(item => item.Item1, StringComparer.Ordinal));
        Assert.Equal(["binoculars"], catalog.FindQuest("eye_for_nature")!.RewardItems);
        Assert.Equal(["magnifier"], catalog.FindQuest("in_the_shade_of_firs")!.RewardItems);
        Assert.Equal(["boots"], catalog.FindQuest("secrets_of_the_bog")!.RewardItems);
        Assert.Null(catalog.FindQuest("below_the_peaks")!.RewardItems);
        Assert.Equal(["snorkel"], catalog.FindQuest("between_salt_and_sea")!.RewardItems);
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
    [InlineData("salamandra_salamandra", "navadni močerad", "kocevje_forest", "kocevje_forest_salamandra_salamandra_1", "fir_beech_forest")]
    [InlineData("salamandra_atra", "planinski močerad", "triglav_alps", "triglav_alps_salamandra_atra_1", "alpine_grassland")]
    public void Repository_content_has_the_salamanders(string id, string slName, string mapId, string spotId, string habitatId)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var species = catalog.FindSpecies(SpeciesId.Parse(id));
        Assert.NotNull(species);
        Assert.Equal((SpeciesGroup.Amphibian, slName, 3), (species.Group, species.Text["sl"].Name.Value, species.Clues.Count));
        Assert.Equal(TorchReaction.Calm, species.Wildlife?.Torch);
        Assert.Equal([Weather.Rain], species.Availability.AlsoInWeather!.Order());
        Assert.DoesNotContain(TimeOfDay.Day, species.Availability.Times);
        Assert.Equal(species.Id, SpotOn(catalog, mapId, spotId)?.SpeciesId);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == habitatId).Species, entry => entry.SpeciesId == species.Id);
    }

    [Theory]
    [InlineData("jure", "Jure", "kocevje_forest", "in_the_shade_of_firs", "fir_beech_forest", "pohorje_open")]
    [InlineData("maja", "Maja", "pohorje_forest", "secrets_of_the_bog", "mountain_forest", "triglav_open")]
    [InlineData("luka", "Luka", "triglav_alps", "below_the_peaks", "alpine_grassland", "alps_explored")]
    [InlineData("neza", "Neža", "cerknica_lake", "vanishing_lake", "wetland", "lake_explored")]
    [InlineData("tilen", "Tilen", "rakov_skocjan_karst", "into_the_dark", "karst", "caves_explored")]
    [InlineData("ana", "Ana", "ljubljana_park", "city_nature", "city", "city_explored")]
    [InlineData("stefan", "Štefan", "murska_sobota_village", "under_the_storks_nest", "farmland", "farmland_explored")]
    [InlineData("nina", "Nina", "portoroz_coast", "between_salt_and_sea", "saltpan", "coast_explored")]
    public void Repository_content_has_the_people_of_the_regions(string npcId, string name, string mapId, string questId, string habitatId, string flag)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(name, catalog.FindNpcOnMap(mapId, npcId)?.Npc.Names["sl"]);
        var quest = catalog.FindQuestByGiver(npcId);
        Assert.NotNull(quest);
        Assert.Equal((questId, 3, habitatId, flag), (quest.Id, quest.IdentifiedSpeciesGoal, quest.GoalHabitatId, quest.RewardFlag));
        Assert.Null(HabitatAt(catalog, mapId, 3, 10));
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
    [InlineData("proteus_anguinus", SpeciesGroup.Amphibian, "človeška ribica", "karst")]
    [InlineData("leptodirus_hochenwartii", SpeciesGroup.Insect, "drobnovratnik", "karst")]
    [InlineData("rhinolophus_ferrumequinum", SpeciesGroup.Mammal, "veliki podkovnjak", "karst")]
    [InlineData("saxifraga_rotundifolia", SpeciesGroup.Plant, "okroglolistni kamnokreč", "karst")]
    [InlineData("chrysosplenium_alternifolium", SpeciesGroup.Plant, "premenjalnolistni vraničnik", "karst")]
    [InlineData("apus_apus", SpeciesGroup.Bird, "hudournik", "city")]
    [InlineData("erinaceus_roumanicus", SpeciesGroup.Mammal, "beloprsi jež", "city")]
    [InlineData("alcedo_atthis", SpeciesGroup.Bird, "vodomec", "city")]
    [InlineData("alnus_glutinosa", SpeciesGroup.Plant, "črna jelša", "city")]
    [InlineData("fritillaria_meleagris", SpeciesGroup.Plant, "močvirska logarica", "wetland")]
    [InlineData("ciconia_ciconia", SpeciesGroup.Bird, "bela štorklja", "farmland")]
    [InlineData("upupa_epops", SpeciesGroup.Bird, "smrdokavra", "farmland")]
    [InlineData("viola_arvensis", SpeciesGroup.Plant, "njivska vijolica", "farmland")]
    [InlineData("lutra_lutra", SpeciesGroup.Mammal, "vidra", "wetland")]
    [InlineData("salix_purpurea", SpeciesGroup.Plant, "rdeča vrba", "wetland")]
    [InlineData("himantopus_himantopus", SpeciesGroup.Bird, "polojnik", "saltpan")]
    [InlineData("egretta_garzetta", SpeciesGroup.Bird, "mala bela čaplja", "saltpan")]
    [InlineData("salicornia_europaea", SpeciesGroup.Plant, "navadni osočnik", "saltpan")]
    [InlineData("aphanius_fasciatus", SpeciesGroup.Fish, "solinarka", "saltpan")]
    [InlineData("sarpa_salpa", SpeciesGroup.Fish, "salpa", "sea")]
    [InlineData("pinna_nobilis", SpeciesGroup.Mollusc, "veliki leščur", "sea")]
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
    [InlineData("kocevje_forest", "fir_beech_forest", new[] { "kocevje_forest_allium_ursinum_1", "kocevje_forest_galium_odoratum_1", "kocevje_forest_cervus_elaphus_1" })]
    [InlineData("pohorje_forest", "mountain_forest", new[] { "pohorje_forest_drosera_rotundifolia_1", "pohorje_forest_vaccinium_myrtillus_1", "pohorje_forest_sciurus_vulgaris_1" })]
    [InlineData("triglav_alps", "alpine_grassland", new[] { "triglav_alps_leontopodium_nivale_1", "triglav_alps_potentilla_nitida_1", "triglav_alps_marmota_marmota_1" })]
    [InlineData("cerknica_lake", "wetland", new[] { "cerknica_lake_ardea_cinerea_1", "cerknica_lake_crex_crex_1", "cerknica_lake_hyla_arborea_1", "cerknica_lake_calopteryx_splendens_1", "cerknica_lake_iris_pseudacorus_1", "cerknica_lake_iris_sibirica_1", "cerknica_lake_nymphaea_alba_1" })]
    public void Region_maps_have_habitat_zones_and_spots(string mapId, string habitatId, string[] spotIds)
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        // The spawn (1, 9), the tile beside it and the signpost (2, 8) lie outside the zones; ground further away does not.
        Assert.Null(HabitatAt(catalog, mapId, 1, 9));
        Assert.Null(HabitatAt(catalog, mapId, 2, 9));
        Assert.Null(HabitatAt(catalog, mapId, 2, 8));
        Assert.Equal(habitatId, HabitatAt(catalog, mapId, 5, 16)?.Id);
        Assert.All(spotIds, spotId => Assert.NotNull(SpotOn(catalog, mapId, spotId)));
    }

    [Fact]
    public void The_olm_is_aquatic_and_lives_in_the_cave()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        Assert.Equal(new WildlifeTraits(TorchReaction.Shy, Aquatic: true), catalog.FindSpecies(SpeciesId.Parse("proteus_anguinus"))!.Wildlife);
        Assert.False(catalog.FindSpecies(SpeciesId.Parse("leptodirus_hochenwartii"))!.Wildlife!.Aquatic);
        Assert.Equal(SpeciesId.Parse("proteus_anguinus"), SpotOn(catalog, "rakov_skocjan_karst", "rakov_skocjan_karst_proteus_anguinus_1")?.SpeciesId);
        // The karst zones lie in the gorge only; nothing is searched in the cave.
        Assert.Equal("karst", HabitatAt(catalog, "rakov_skocjan_karst", 5, 3)?.Id);
        Assert.Null(HabitatAt(catalog, "rakov_skocjan_karst", 21, 8));
    }

    [Fact]
    public void The_ljubljana_park_has_a_city_zone_the_barje_and_their_spots()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());
        const string map = "ljubljana_park";

        // The spawn (1, 9), the signpost (2, 8) and Ana (3, 10) lie outside the zones.
        Assert.Null(HabitatAt(catalog, map, 1, 9));
        Assert.Null(HabitatAt(catalog, map, 2, 8));
        // The generated park (rows 5–15) is city habitat, the barje beyond the river (rows 16–19) wetland.
        Assert.Contains(Map(catalog, map)!.Habitats, zone => zone.HabitatId == "city" && zone.MinY >= 5 && zone.MaxY <= 15);
        Assert.Equal("wetland", HabitatAt(catalog, map, 8, 17)?.Id);
        Assert.Null(HabitatAt(catalog, map, 13, 3)); // the street
        string[][] spots = [["ljubljana_park_crex_crex_1", "crex_crex"], ["ljubljana_park_fritillaria_meleagris_1", "fritillaria_meleagris"], ["ljubljana_park_erinaceus_roumanicus_1", "erinaceus_roumanicus"], ["ljubljana_park_alcedo_atthis_1", "alcedo_atthis"], ["ljubljana_park_apus_apus_1", "apus_apus"]];
        Assert.All(spots, spot => Assert.Equal(spot[1], SpotOn(catalog, map, spot[0])?.SpeciesId.Value));
    }

    [Fact]
    public void The_murska_sobota_village_has_the_stork_on_a_chimney_fields_and_the_oxbow()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());
        const string map = "murska_sobota_village";

        Assert.Equal(new WildlifeTraits(TorchReaction.Calm, Perched: true), catalog.FindSpecies(SpeciesId.Parse("ciconia_ciconia"))!.Wildlife);
        Assert.Equal(new WildlifeTraits(TorchReaction.Shy, Aquatic: true), catalog.FindSpecies(SpeciesId.Parse("lutra_lutra"))!.Wildlife);
        Assert.Contains(catalog.AllHabitats.Single(habitat => habitat.Id == "farmland").Species, entry => entry.SpeciesId == SpeciesId.Parse("alauda_arvensis"));

        // The spawn (1, 9), the signpost (2, 8), Štefan (3, 10) and the station (6, 8) lie outside the zones.
        Assert.All(new[] { (1, 9), (2, 8), (3, 10), (6, 8) }, tile => Assert.Null(HabitatAt(catalog, map, tile.Item1, tile.Item2)));
        // Generated: the orchard and the fields are farmland, the oxbow and the Mura wetland.
        var village = Map(catalog, map)!;
        Assert.Contains(village.Habitats, zone => zone.HabitatId == "farmland" && zone.MaxY <= 13);
        Assert.Contains(village.Habitats, zone => zone.HabitatId == "wetland" && zone.MinY >= 9);
        Assert.Equal("wetland", HabitatAt(catalog, map, 5, 14)?.Id);
        string[][] spots = [["murska_sobota_village_ciconia_ciconia_1", "ciconia_ciconia"], ["murska_sobota_village_upupa_epops_1", "upupa_epops"], ["murska_sobota_village_alauda_arvensis_1", "alauda_arvensis"], ["murska_sobota_village_viola_arvensis_1", "viola_arvensis"], ["murska_sobota_village_lutra_lutra_1", "lutra_lutra"]];
        Assert.All(spots, spot => Assert.Equal(spot[1], SpotOn(catalog, map, spot[0])?.SpeciesId.Value));
    }

    [Fact]
    public void The_portoroz_coast_has_the_salt_pans_and_sea_life()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());
        const string map = "portoroz_coast";

        Assert.Equal(new WildlifeTraits(TorchReaction.Calm, Aquatic: true), catalog.FindSpecies(SpeciesId.Parse("sarpa_salpa"))!.Wildlife);
        Assert.Equal(new WildlifeTraits(TorchReaction.Shy, Aquatic: true), catalog.FindSpecies(SpeciesId.Parse("aphanius_fasciatus"))!.Wildlife);
        Assert.Equal(new WildlifeTraits(TorchReaction.Calm, Perched: true), catalog.FindSpecies(SpeciesId.Parse("pinna_nobilis"))!.Wildlife);

        // The spawn (1, 9), the signpost (2, 8), Nina (3, 10) and the station (6, 8) lie outside the zones, and so does the sea.
        Assert.All(new[] { (1, 9), (2, 8), (3, 10), (6, 8), (6, 14) }, tile => Assert.Null(HabitatAt(catalog, map, tile.Item1, tile.Item2)));
        Assert.Equal("saltpan", HabitatAt(catalog, map, 17, 6)?.Id);
        string[][] spots = [["portoroz_coast_himantopus_himantopus_1", "himantopus_himantopus"], ["portoroz_coast_egretta_garzetta_1", "egretta_garzetta"], ["portoroz_coast_aphanius_fasciatus_1", "aphanius_fasciatus"], ["portoroz_coast_salicornia_europaea_1", "salicornia_europaea"], ["portoroz_coast_sarpa_salpa_1", "sarpa_salpa"], ["portoroz_coast_pinna_nobilis_1", "pinna_nobilis"]];
        Assert.All(spots, spot => Assert.Equal(spot[1], SpotOn(catalog, map, spot[0])?.SpeciesId.Value));
    }

    [Fact]
    public void The_corncrake_lives_in_the_wet_meadow_of_the_lake()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());

        var spot = SpotOn(catalog, "cerknica_lake", "cerknica_lake_crex_crex_1");
        Assert.Equal(SpeciesId.Parse("crex_crex"), spot?.SpeciesId);
        Assert.Equal("wetland", HabitatAt(catalog, "cerknica_lake", 5, 5)?.Id);
        Assert.Equal("wetland", HabitatAt(catalog, "cerknica_lake", 5, 12)?.Id);
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
    [InlineData("proteus_anguinus", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("rhinolophus_ferrumequinum", new[] { Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("saxifraga_rotundifolia", new[] { Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("chrysosplenium_alternifolium", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("apus_apus", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("erinaceus_roumanicus", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("alcedo_atthis", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("fritillaria_meleagris", new[] { Season.Spring }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("alnus_glutinosa", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("ciconia_ciconia", new[] { Season.Spring, Season.Summer }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening })]
    [InlineData("upupa_epops", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening })]
    [InlineData("lutra_lutra", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("viola_arvensis", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("salix_purpurea", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("himantopus_himantopus", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("egretta_garzetta", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("salicornia_europaea", new[] { Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("aphanius_fasciatus", new[] { Season.Spring, Season.Summer, Season.Autumn }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("sarpa_salpa", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
    [InlineData("pinna_nobilis", new[] { Season.Spring, Season.Summer, Season.Autumn, Season.Winter }, new[] { TimeOfDay.Morning, TimeOfDay.Day, TimeOfDay.Evening, TimeOfDay.Night })]
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
        Assert.Equal(SpeciesId.Parse("lanius_collurio"), SpotOn(catalog, "dravsko_polje_meadow", "dravsko_polje_meadow_lanius_collurio_1")?.SpeciesId);
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

        Assert.NotNull(SpotOn(catalog, "test_meadow", "sage_1"));
        Assert.Equal("tall_grass", HabitatAt(catalog, "test_meadow", 1, 0)?.Id);
        Assert.Equal("tall_grass", HabitatAt(catalog, "test_meadow", 2, 2)?.Id);
        Assert.Null(HabitatAt(catalog, "test_meadow", 0, 1));
        Assert.Null(HabitatAt(catalog, "test_meadow", 3, 1));
        Assert.Null(HabitatAt(catalog, "other_map", 1, 0));
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
        { "lamp post that is not a tile object", c => Objects(c).Add(ContentFolder.TileObject("lamp", "note", "lamp_1", gid: 0)), "lamp 'lamp_1' must be a tile object" },
        { "lamp post outside the map", c => Objects(c).Add(ContentFolder.TileObject("lamp", "note", "lamp_far", tileX: 9)), "lamp 'lamp_far' lies outside the map" },
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
        { "animal with a non-boolean aquatic trait", c => { c.Species["group"] = "mammal"; c.Species["wildlife"] = new JsonObject { ["torch"] = "calm", ["aquatic"] = "yes" }; }, "species/salvia_pratensis.json: invalid JSON" },
        { "animal with a non-boolean perched trait", c => { c.Species["group"] = "bird"; c.Species["wildlife"] = new JsonObject { ["torch"] = "calm", ["perched"] = "yes" }; }, "species/salvia_pratensis.json: invalid JSON" },
        { "animal both aquatic and perched", c => { c.Species["group"] = "bird"; c.Species["wildlife"] = new JsonObject { ["torch"] = "calm", ["aquatic"] = true, ["perched"] = true }; }, "species/salvia_pratensis.json: an animal cannot be both aquatic and perched" },
        { "area with a non-boolean underground", c => Objects(c).First(o => (string?)o!["type"] == "area")!["properties"]!.AsArray().Add(new JsonObject { ["name"] = "underground", ["type"] = "string", ["value"] = "yes" }), "'underground' must be a boolean" },
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

    [Theory]
    [InlineData("""{ "id": "test_peaks", "floor": [0], "layers": [{ "id": "snow", "coverage": 0.2, "scale": 3, "smooth": 1, "bias": "up" }] }""", "layer 'snow' needs")]
    [InlineData("""{ "id": "test_peaks", "floor": [0], "layers": [{ "id": "snow", "coverage": 0.2, "scale": 3, "smooth": 1, "bias": "north", "biasStrength": 2 }] }""", "layer 'snow' needs")]
    [InlineData("""{ "id": "test_lake", "floor": [0], "water": { "kind": "shore", "edge": "up", "chance": 1, "size": 2, "tiles": [0] } }""", "'water' needs")]
    [InlineData("""{ "id": "test_lake", "floor": [0], "water": { "kind": "shore", "chance": 1, "size": 2, "tiles": [0], "shallowWidth": 2 } }""", "'water' needs")]
    [InlineData("""{ "id": "test_lake", "floor": [0], "water": { "kind": "sea", "chance": 1, "size": 2, "tiles": [0] } }""", "'water' needs")]
    public void Broken_biome_rules_are_rejected(string biome, string expectedError)
    {
        using var content = new ContentFolder();
        var folder = content.Write();
        Directory.CreateDirectory(Path.Combine(folder, "biomes"));
        File.WriteAllText(Path.Combine(folder, "biomes", "broken.json"), biome);

        var error = Assert.Throws<ContentValidationException>(() => FileContentCatalog.Load(folder));

        Assert.Contains(error.Errors, message => message.StartsWith("biomes/broken.json", StringComparison.Ordinal) && message.Contains(expectedError, StringComparison.Ordinal));
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
