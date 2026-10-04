using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Application.Stations;
using Slovion.Application.Tests.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Saves;

namespace Slovion.Application.Tests.Stations;

public class StationServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly FakeContentCatalog catalog = new(
        FakeContentCatalog.Species("abies_alba", "navadna jelka", "silver fir"),
        FakeContentCatalog.Species("fagus_sylvatica", "navadna bukev"),
        FakeContentCatalog.Species("picea_abies", "navadna smreka"),
        FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"));
    private readonly SaveSlot save = SaveSlot.Create(Guid.NewGuid(), [1], June1);
    private readonly StationService service;
    private readonly EncounterService encounters;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public StationServiceTests()
    {
        catalog.Stations.Add(StationOf("forest_station", 2, "abies_alba", "fagus_sylvatica", "picea_abies"));
        catalog.Stations.Add(StationOf("meadow_station", 1, "salvia_pratensis"));
        service = new StationService(catalog, discoveries);
        encounters = new EncounterService(catalog, discoveries, new InMemoryEncounterRepository(), new SeededRandom(1), time);
    }

    [Fact]
    public async Task A_new_save_has_researched_nothing_and_knows_no_names()
    {
        var stations = await service.ListAsync(save, "sl", Token);

        Assert.Equal(["forest_station", "meadow_station"], stations.Select(station => station.StationId));
        var forest = stations[0];
        Assert.Equal(("forest_station ime", "forest_station tema", "test_meadow", 2, 0, false), (forest.Name, forest.Theme, forest.MapId, forest.Goal, forest.Researched, forest.Met));
        Assert.All(forest.Species, species => Assert.Equal((0, (string?)null), (species.Level, species.Name)));
    }

    [Fact]
    public async Task Progress_counts_fully_researched_species_and_names_identified_ones()
    {
        await ResearchTo("abies_alba", 3);
        await ResearchTo("fagus_sylvatica", 2);

        var forest = (await service.ListAsync(save, "en", Token))[0];

        Assert.Equal((1, false), (forest.Researched, forest.Met));
        Assert.Equal(
            [("abies_alba", 3, "silver fir"), ("fagus_sylvatica", 2, "navadna bukev"), ("picea_abies", 0, null)],
            forest.Species.Select(species => (species.SpeciesId.Value, species.Level, species.Name)));
    }

    [Fact]
    public async Task The_goal_is_met_with_enough_fully_researched_species()
    {
        await ResearchTo("abies_alba", 3);
        await ResearchTo("picea_abies", 3);

        var forest = (await service.ListAsync(save, "sl", Token))[0];

        Assert.Equal((2, true), (forest.Researched, forest.Met));
    }

    [Fact]
    public async Task The_sighting_that_meets_a_goal_earns_its_certificate_once()
    {
        await ResearchTo("abies_alba", 3);
        await ResearchTo("picea_abies", 2);

        // The spruce's third research step meets the forest station's goal of two.
        var meeting = await SightAt("picea_abies", NightOf(day: 1));
        Assert.Equal((true, 3), (meeting.Researched, meeting.Entry.ResearchLevel));
        Assert.Equal([new CertificateView("forest_station", "forest_station ime")], meeting.NewCertificates);

        // A further species at level 3 for a met goal earns nothing new.
        await ResearchTo("fagus_sylvatica", 2);
        var beyond = await SightAt("fagus_sylvatica", NightOf(day: 1));
        Assert.Equal((true, 3), (beyond.Researched, beyond.Entry.ResearchLevel));
        Assert.Empty(beyond.NewCertificates);
    }

    [Fact]
    public async Task Research_steps_below_the_top_level_earn_nothing()
    {
        await ResearchTo("salvia_pratensis", 1);

        var evening = await SightAt("salvia_pratensis", June1.AddSeconds(600));

        Assert.Equal((true, 2), (evening.Researched, evening.Entry.ResearchLevel));
        Assert.Empty(evening.NewCertificates);
    }

    /// <summary>Identifies the species in the morning, then researches it in the evening (2) and at night (3), on day 0.</summary>
    private async Task ResearchTo(string id, int level)
    {
        var speciesId = SpeciesId.Parse(id);
        await discoveries.AddIfAbsentAsync(SpeciesDiscovery.Observe(save.Id, Sighting.AtSpot(new MapSpot(FakeContentCatalog.MapId, id, speciesId)), June1), Token);
        await discoveries.IdentifyAsync(save.Id, speciesId, June1, Token);
        if (level >= 2)
        {
            await discoveries.ResearchAsync(save.Id, speciesId, June1.AddSeconds(600), save.CreatedAt, Token); // 18:00, evening
        }

        if (level >= 3)
        {
            await discoveries.ResearchAsync(save.Id, speciesId, June1.AddSeconds(840), save.CreatedAt, Token); // 22:00, night
        }
    }

    /// <summary>A sighting of the species' spot at the given real time, through the encounter service.</summary>
    private async Task<StartEncounterResult.AlreadyIdentified> SightAt(string id, DateTimeOffset at)
    {
        time.SetUtcNow(at);
        return Assert.IsType<StartEncounterResult.AlreadyIdentified>(await encounters.StartAsync(save, FakeContentCatalog.MapId, id, "sl", Token));
    }

    /// <summary>22:00 in-game on the given day (one in-game day is 1,440 real seconds; day 0 starts at 08:00).</summary>
    private static DateTimeOffset NightOf(int day) => June1.AddSeconds((day * 1440) + 840);

    private static Station StationOf(string id, int goal, params string[] species) =>
        new(id, FakeContentCatalog.MapId, species.Select(SpeciesId.Parse).ToList(), goal, new Dictionary<string, StationText> { ["sl"] = new($"{id} ime", $"{id} tema") });
}
