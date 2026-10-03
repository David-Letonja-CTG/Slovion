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
    private static readonly SpeciesId Skylark = SpeciesId.Parse("alauda_arvensis");
    private static readonly Dictionary<string, string> Names = new() { ["sl"] = "Visoka trava" };
    private readonly Guid slot = Guid.NewGuid();
    private readonly FakeTimeProvider clock = new();
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly FakeContentCatalog catalog = new(
        FakeContentCatalog.Species("lepus_europaeus", "poljski zajec", group: SpeciesGroup.Mammal),
        FakeContentCatalog.Species("alauda_arvensis", "poljski škrjanec", group: SpeciesGroup.Bird),
        FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"));

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public SearchTests()
    {
        // Weights 3:1 for hare and skylark; tiles with x ≥ 10 are tall grass.
        catalog.Grass = new Habitat("tall_grass", Names, 1, 70, [new(Hare, 3), new(Skylark, 1)]);
    }

    /// <summary>A save created when the test clock starts: spring, 08:00 in-game.</summary>
    private SaveSlot Save => SaveSlot.Create(slot, [1], new FakeTimeProvider().GetUtcNow());

    private EncounterService Service(IRandomSource random) =>
        new(catalog, discoveries, new InMemoryEncounterRepository(), random, clock);

    private Task<SearchResult> Search(EncounterService service, int x = 12) =>
        service.SearchAsync(Save, FakeContentCatalog.MapId, x, 3, "sl", Token);

    [Fact]
    public async Task A_roll_above_the_chance_finds_nothing_and_records_nothing()
    {
        var result = await Search(Service(new ScriptedRandom(70))); // 70 is not below 70 %

        Assert.IsType<SearchResult.NothingFound>(result);
        Assert.Null(await discoveries.FindAsync(slot, Hare, Token));
    }

    [Fact]
    public async Task A_found_species_opens_an_encounter_and_records_the_habitat()
    {
        var result = await Search(Service(new ScriptedRandom(69, 3))); // found; weight roll 3 → skylark

        var started = Assert.IsType<StartEncounterResult.Started>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal(SpeciesGroup.Bird, started.Encounter.Group);
        var observation = await discoveries.FindAsync(slot, Skylark, Token);
        Assert.Equal((null, "tall_grass"), (observation?.SpotId, observation?.HabitatId));
    }

    [Fact]
    public async Task Finding_an_identified_species_says_so()
    {
        var service = Service(new ScriptedRandom());
        var atSpot = Assert.IsType<StartEncounterResult.Started>(
            await service.StartAsync(Save, FakeContentCatalog.MapId, "lepus_europaeus", "sl", Token));
        await service.AnswerAsync(slot, atSpot.Encounter.EncounterId, "lepus_europaeus", "sl", Token);

        var result = await Search(Service(new ScriptedRandom(0, 0))); // found; weight roll 0 → hare

        var known = Assert.IsType<StartEncounterResult.AlreadyIdentified>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal("poljski zajec", known.Entry.Species?.Name);
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
    public async Task Weights_decide_how_often_each_species_is_found()
    {
        catalog.Grass = new Habitat("tall_grass", Names, 1, 100, [new(Hare, 3), new(Skylark, 1)]);
        var service = Service(new SeededRandom(123));
        var counts = new Dictionary<SpeciesGroup, int> { [SpeciesGroup.Mammal] = 0, [SpeciesGroup.Bird] = 0 };

        for (var i = 0; i < 4000; i++)
        {
            var found = (SearchResult.Found)await service.SearchAsync(SaveSlot.Create(Guid.NewGuid(), [1], new FakeTimeProvider().GetUtcNow()), FakeContentCatalog.MapId, 12, 3, "sl", Token);
            counts[((StartEncounterResult.Started)found.Encounter).Encounter.Group]++;
        }

        var ratio = (double)counts[SpeciesGroup.Mammal] / counts[SpeciesGroup.Bird];
        Assert.InRange(ratio, 2.6, 3.4);
    }

    [Fact]
    public async Task Only_species_available_now_are_found()
    {
        // The sage (weight 100) flowers in spring and summer; in winter only the hare (weight 1) is left.
        catalog.Grass = new Habitat("tall_grass", Names, 1, 100, [new(SpeciesId.Parse("salvia_pratensis"), 100), new(Hare, 1)]);
        catalog.Replace(FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja", null, SpeciesGroup.Plant, Season.Spring, Season.Summer));
        clock.Advance(TimeSpan.FromSeconds(12960)); // day 10: winter

        var result = await Search(Service(new ScriptedRandom(0, 0)));

        var found = Assert.IsType<StartEncounterResult.Started>(Assert.IsType<SearchResult.Found>(result).Encounter);
        Assert.Equal(SpeciesGroup.Mammal, found.Encounter.Group);
    }

    [Fact]
    public async Task A_habitat_with_nothing_available_finds_nothing()
    {
        catalog.Grass = new Habitat("tall_grass", Names, 1, 100, [new(SpeciesId.Parse("salvia_pratensis"), 1)]);
        catalog.Replace(FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja", null, SpeciesGroup.Plant, Season.Spring, Season.Summer));
        clock.Advance(TimeSpan.FromSeconds(12960)); // winter

        Assert.IsType<SearchResult.NothingFound>(await Search(Service(new ScriptedRandom(0, 0))));
        Assert.Empty(await discoveries.ListAsync(slot, Token));
    }
}
