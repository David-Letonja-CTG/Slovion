using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Discovery;
using Slovion.Application.Tests.Discovery;
using Slovion.Application.Weather;
using Slovion.Application.Wildlife;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;
using WeatherKind = Slovion.Domain.World.Weather;

namespace Slovion.Application.Tests.Weather;

public class WeatherAvailabilityTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly Guid slot = Guid.NewGuid();

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    /// <summary>The save, created when the test clock starts: spring, 08:00 in-game (by day after 10:00).</summary>
    private SaveSlot Save => SaveSlot.Create(slot, [1], June1);

    /// <summary>A catalog with a night-only salamander that also comes out in rain, on a map whose region always has <paramref name="weather"/>.</summary>
    private static FakeContentCatalog CatalogWith(WeatherKind weather)
    {
        var night = FakeContentCatalog.Species("salamandra_salamandra", "navadni močerad", group: SpeciesGroup.Amphibian);
        var salamander = night with
        {
            Availability = new Availability(Enum.GetValues<Season>().ToHashSet(), new HashSet<TimeOfDay> { TimeOfDay.Night }, ["src"], new HashSet<WeatherKind> { WeatherKind.Rain }),
        };
        var catalog = new FakeContentCatalog(salamander, FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"), FakeContentCatalog.Species("taraxacum_officinale", "navadni regrat"));
        var always = new Dictionary<WeatherKind, int> { [weather] = 1 };
        catalog.Regions.Add(new Region("test", FakeContentCatalog.MapId, 1, 50, 50, new UnlockRule.Always(), new Dictionary<string, RegionText> { ["sl"] = new("Test", "Namig") }, Enum.GetValues<Season>().ToDictionary(season => season, IReadOnlyDictionary<WeatherKind, int> (_) => always)));
        return catalog;
    }

    [Theory]
    [InlineData(WeatherKind.Rain, true)]
    [InlineData(WeatherKind.Clear, false)]
    [InlineData(WeatherKind.Fog, false)]
    public async Task A_night_species_also_found_in_rain_comes_out_by_day_only_in_rain(WeatherKind weather, bool found)
    {
        var catalog = CatalogWith(weather);
        var encounters = new EncounterService(catalog, catalog, new InMemoryDiscoveryRepository(), new InMemoryEncounterRepository(), new SeededRandom(1), time);
        var wildlife = new WildlifeService(catalog, catalog, time);
        time.Advance(TimeSpan.FromSeconds(180)); // 11:00, by day

        var result = await encounters.StartAsync(Save, FakeContentCatalog.MapId, "salamandra_salamandra", "sl", Token);
        var resident = Assert.Single(wildlife.List(Save, FakeContentCatalog.MapId)!);

        Assert.Equal(found, result is StartEncounterResult.Started);
        Assert.Equal(found, resident.Present);
        Assert.Equal(weather, new WeatherService(catalog, time).Current(Save, FakeContentCatalog.MapId)?.Weather);
    }
}
