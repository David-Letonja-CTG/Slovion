using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;

namespace Slovion.Application.Tests.Discovery;

public class NatureDexServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly Guid slot = Guid.NewGuid();
    private readonly EncounterService encounters;
    private readonly NatureDexService service;

    public NatureDexServiceTests()
    {
        var catalog = new FakeContentCatalog(
            FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"),
            FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"));
        var discoveries = new InMemoryDiscoveryRepository();
        encounters = new EncounterService(catalog, discoveries, new InMemoryEncounterRepository(), new SeededRandom(1), time);
        service = new NatureDexService(catalog, discoveries);
    }

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private async Task Observe(string spotId) =>
        await encounters.StartAsync(slot, FakeContentCatalog.MapId, spotId, "sl", Token);

    [Fact]
    public async Task Lists_oldest_observation_first()
    {
        await Observe("taraxacum_officinale");
        time.Advance(TimeSpan.FromMinutes(5));
        await Observe("salvia_pratensis");

        var entries = await service.GetAsync(slot, "sl", Token);

        Assert.Equal(["taraxacum_officinale", "salvia_pratensis"], entries.Select(e => e.SpeciesId.Value));
    }

    [Fact]
    public async Task Is_per_save_slot()
    {
        await Observe("salvia_pratensis");

        Assert.Empty(await service.GetAsync(Guid.NewGuid(), "sl", Token));
    }

    [Fact]
    public async Task Identified_entries_list_only_the_sources_their_facts_use()
    {
        await Observe("salvia_pratensis");
        var open = (StartEncounterResult.Started)await encounters.StartAsync(slot, FakeContentCatalog.MapId, "salvia_pratensis", "sl", Token);
        await encounters.AnswerAsync(slot, open.Encounter.EncounterId, "salvia_pratensis", "sl", Token);

        var entry = Assert.Single(await service.GetAsync(slot, "sl", Token));

        Assert.True(entry.IsIdentified);
        var source = Assert.Single(entry.Species!.Sources);
        Assert.Equal("Title", source.Title);
    }
}
