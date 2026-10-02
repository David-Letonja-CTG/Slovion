using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;

namespace Slovion.Application.Tests.Discovery;

public class DiscoveryServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly InMemoryDiscoveryRepository repository = new();
    private readonly Guid slot = Guid.NewGuid();
    private readonly DiscoveryService service;

    public DiscoveryServiceTests()
    {
        var catalog = new FakeContentCatalog(
            FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja", "meadow clary"),
            FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"));
        service = new DiscoveryService(catalog, repository, time);
    }

    private Task<RecordDiscoveryResult> Discover(string spotId, string language = "sl") =>
        service.RecordAsync(slot, FakeContentCatalog.MapId, spotId, language, TestContext.Current.CancellationToken);

    [Fact]
    public async Task First_discovery_is_new_and_uses_the_server_clock()
    {
        var result = Assert.IsType<RecordDiscoveryResult.Recorded>(await Discover("salvia_pratensis"));

        Assert.True(result.IsNew);
        Assert.Equal(June1, result.Entry.DiscoveredAt);
        Assert.Equal(SpeciesId.Parse("salvia_pratensis"), result.Entry.SpeciesId);
        Assert.Equal("travniška kadulja", result.Entry.Species.Name);
    }

    [Fact]
    public async Task Repeat_discovery_keeps_the_original_time()
    {
        await Discover("salvia_pratensis");
        time.Advance(TimeSpan.FromHours(3));

        var result = Assert.IsType<RecordDiscoveryResult.Recorded>(await Discover("salvia_pratensis"));

        Assert.False(result.IsNew);
        Assert.Equal(June1, result.Entry.DiscoveredAt);
    }

    [Theory]
    [InlineData("test_meadow", "does_not_exist")]
    [InlineData("other_map", "salvia_pratensis")]
    public async Task Unknown_spot_records_nothing(string mapId, string spotId)
    {
        var result = await service.RecordAsync(slot, mapId, spotId, "sl", TestContext.Current.CancellationToken);

        Assert.IsType<RecordDiscoveryResult.UnknownSpot>(result);
        Assert.Empty(await service.GetNatureDexAsync(slot, "sl", TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task NatureDex_lists_oldest_discovery_first()
    {
        await Discover("taraxacum_officinale");
        time.Advance(TimeSpan.FromMinutes(5));
        await Discover("salvia_pratensis");

        var entries = await service.GetNatureDexAsync(slot, "sl", TestContext.Current.CancellationToken);

        Assert.Equal(["taraxacum_officinale", "salvia_pratensis"], entries.Select(e => e.SpeciesId.Value));
    }

    [Fact]
    public async Task NatureDex_is_per_save_slot()
    {
        await Discover("salvia_pratensis");

        var other = await service.GetNatureDexAsync(Guid.NewGuid(), "sl", TestContext.Current.CancellationToken);

        Assert.Empty(other);
    }

    [Fact]
    public async Task Text_falls_back_to_Slovenian_when_the_language_is_missing()
    {
        var english = Assert.IsType<RecordDiscoveryResult.Recorded>(await Discover("salvia_pratensis", "en"));
        var fallback = Assert.IsType<RecordDiscoveryResult.Recorded>(await Discover("taraxacum_officinale", "en"));

        Assert.Equal(("en", "meadow clary"), (english.Entry.Species.Language, english.Entry.Species.Name));
        Assert.Equal(("sl", "navadni regrat"), (fallback.Entry.Species.Language, fallback.Entry.Species.Name));
    }

    [Fact]
    public async Task Entry_lists_only_the_sources_its_facts_use()
    {
        var result = Assert.IsType<RecordDiscoveryResult.Recorded>(await Discover("salvia_pratensis"));

        var source = Assert.Single(result.Entry.Species.Sources);
        Assert.Equal("Title", source.Title);
    }
}
