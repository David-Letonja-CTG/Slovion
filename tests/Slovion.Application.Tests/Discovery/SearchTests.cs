using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;

namespace Slovion.Application.Tests.Discovery;

/// <summary>Returns the scripted values first, then 0 (e.g. for candidate shuffling).</summary>
internal sealed class ScriptedRandom(params int[] values) : IRandomSource
{
    private readonly Queue<int> queue = new(values);

    public int NextIndex(int maxExclusive) => queue.Count > 0 ? queue.Dequeue() : 0;
}

public class SearchTests
{
    private static readonly SpeciesId Hare = SpeciesId.Parse("lepus_europaeus");
    private static readonly SpeciesId Dandelion = SpeciesId.Parse("taraxacum_officinale");
    private static readonly SpeciesId Sage = SpeciesId.Parse("salvia_pratensis");
    private static readonly Dictionary<string, string> Names = new() { ["sl"] = "Visoka trava" };
    private readonly Guid slot = Guid.NewGuid();
    private readonly FakeTimeProvider clock = new();
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly FakeContentCatalog catalog = new(
        FakeContentCatalog.Species("lepus_europaeus", "poljski zajec", group: SpeciesGroup.Mammal),
        FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"),
        FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"));

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public SearchTests()
    {
        // The hare is listed first and heaviest, but animals are found by meeting them, never by searching.
        // Plant weights 3:1 for dandelion and sage; tiles with x ≥ 10 are tall grass.
        catalog.Grass = new Habitat("tall_grass", Names, 1, 70, [new(Hare, 100), new(Dandelion, 3), new(Sage, 1)]);
    }

    /// <summary>A save created when the test clock starts: spring, 08:00 in-game.</summary>
    private SaveSlot Save => SaveSlot.Create(slot, [1], new FakeTimeProvider().GetUtcNow());

    private EncounterService Service(IRandomSource random) =>
        new(catalog, catalog, discoveries, new InMemoryEncounterRepository(), random, clock);

    private Task<SearchResult> Search(EncounterService service, int x = 12) =>
        service.SearchAsync(Save, FakeContentCatalog.MapId, x, 3, "sl", Token);

    /// <summary>The species the slot observed (searches record the first observation).</summary>
    private async Task<SpeciesId?> ObservedBy(Guid slotId) =>
        (await discoveries.ListAsync(slotId, Token)).SingleOrDefault()?.SpeciesId;

    [Fact]
    public async Task A_roll_above_the_chance_finds_nothing_and_records_nothing()
    {
        var result = await Search(Service(new ScriptedRandom(70))); // 70 is not below 70 %

        Assert.IsType<SearchResult.NothingFound>(result);
        Assert.Empty(await discoveries.ListAsync(slot, Token));
    }

    [Fact]
    public async Task A_found_plant_opens_an_encounter_and_records_the_habitat()
    {
        var result = await Search(Service(new ScriptedRandom(69, 3))); // found; plant weight roll 3 → sage

        var started = Assert.IsType<StartEncounterResult.Started>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal(SpeciesGroup.Plant, started.Encounter.Group);
        var observation = await discoveries.FindAsync(slot, Sage, Token);
        Assert.Equal((null, "tall_grass"), (observation?.SpotId, observation?.HabitatId));
    }

    [Fact]
    public async Task Searches_never_find_animals()
    {
        for (var roll = 0; roll < 4; roll++)
        {
            var slotId = Guid.NewGuid();
            await Service(new ScriptedRandom(0, roll)).SearchAsync(SaveSlot.Create(slotId, [1], new FakeTimeProvider().GetUtcNow()), FakeContentCatalog.MapId, 12, 3, "sl", Token);

            Assert.NotEqual(Hare, await ObservedBy(slotId));
        }
    }

    [Fact]
    public async Task Finding_an_identified_species_says_so()
    {
        var service = Service(new ScriptedRandom());
        var atSpot = Assert.IsType<StartEncounterResult.Started>(
            await service.StartAsync(Save, FakeContentCatalog.MapId, "taraxacum_officinale", "sl", Token));
        await service.AnswerAsync(slot, atSpot.Encounter.EncounterId, "taraxacum_officinale", "sl", Token);

        var result = await Search(Service(new ScriptedRandom(0, 0))); // found; plant weight roll 0 → dandelion

        var known = Assert.IsType<StartEncounterResult.AlreadyIdentified>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal("navadni regrat", known.Entry.Species?.Name);
        Assert.False(known.Researched);

        clock.Advance(TimeSpan.FromSeconds(600)); // evening: finding it again researches it
        var later = Assert.IsType<StartEncounterResult.AlreadyIdentified>(Assert.IsType<SearchResult.Found>(await Search(Service(new ScriptedRandom(0, 0)))).Encounter);
        Assert.Equal((true, 2), (later.Researched, later.Entry.ResearchLevel));
    }

    [Theory]
    [InlineData("test_meadow", 9)] // outside the grass
    [InlineData("other_map", 12)]
    public async Task Tiles_outside_every_habitat_are_unknown(string mapId, int x)
    {
        var result = await Service(new ScriptedRandom()).SearchAsync(Save, mapId, x, 3, "sl", Token);

        Assert.IsType<SearchResult.UnknownHabitat>(result);
    }

    [Fact]
    public async Task Outcomes_are_deterministic_for_a_seed()
    {
        static string Describe(SearchResult result) => result switch
        {
            SearchResult.Found { Encounter: StartEncounterResult.Started started } =>
                $"{started.Encounter.Group}:{string.Join(",", started.Encounter.Candidates.Select(c => c.SpeciesId.Value))}",
            _ => result.GetType().Name,
        };

        var first = new List<string>();
        var second = new List<string>();
        var one = Service(new SeededRandom(5));
        var two = Service(new SeededRandom(5));
        for (var i = 0; i < 10; i++)
        {
            first.Add(Describe(await one.SearchAsync(SaveSlot.Create(Guid.NewGuid(), [1], new FakeTimeProvider().GetUtcNow()), FakeContentCatalog.MapId, 12, 3, "sl", Token)));
            second.Add(Describe(await two.SearchAsync(SaveSlot.Create(Guid.NewGuid(), [1], new FakeTimeProvider().GetUtcNow()), FakeContentCatalog.MapId, 12, 3, "sl", Token)));
        }

        Assert.Equal(first, second);
    }

    [Fact]
    public async Task Weights_decide_how_often_each_plant_is_found()
    {
        catalog.Grass = new Habitat("tall_grass", Names, 1, 100, [new(Hare, 100), new(Dandelion, 3), new(Sage, 1)]);
        var service = Service(new SeededRandom(123));
        var counts = new Dictionary<SpeciesId, int> { [Dandelion] = 0, [Sage] = 0 };

        for (var i = 0; i < 4000; i++)
        {
            var slotId = Guid.NewGuid();
            await service.SearchAsync(SaveSlot.Create(slotId, [1], new FakeTimeProvider().GetUtcNow()), FakeContentCatalog.MapId, 12, 3, "sl", Token);
            counts[(await ObservedBy(slotId))!.Value]++;
        }

        var ratio = (double)counts[Dandelion] / counts[Sage];
        Assert.InRange(ratio, 2.6, 3.4);
    }

    [Fact]
    public async Task Only_plants_available_now_are_found()
    {
        // The dandelion (weight 3) flowers in spring and autumn; in summer only the sage (weight 1) is left.
        catalog.Replace(FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat", null, SpeciesGroup.Plant, Season.Spring, Season.Autumn));
        clock.Advance(TimeSpan.FromSeconds(3840)); // day 4: summer

        var result = await Search(Service(new ScriptedRandom(0, 0)));

        Assert.IsType<StartEncounterResult.Started>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal(Sage, await ObservedBy(slot));
    }

    [Fact]
    public async Task A_habitat_with_nothing_available_finds_nothing()
    {
        catalog.Grass = new Habitat("tall_grass", Names, 1, 100, [new(Hare, 1), new(Sage, 1)]);
        catalog.Replace(FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja", null, SpeciesGroup.Plant, Season.Spring, Season.Summer));
        clock.Advance(TimeSpan.FromSeconds(12960)); // winter: the sage is gone, and the hare is never searched for

        Assert.IsType<SearchResult.NothingFound>(await Search(Service(new ScriptedRandom(0, 0))));
        Assert.Empty(await discoveries.ListAsync(slot, Token));
    }
}
