using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Tests.Discovery;
using Slovion.Application.Wildlife;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;
using Slovion.Domain.World;

namespace Slovion.Application.Tests.Wildlife;

public class WildlifeServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private readonly FakeTimeProvider time = new(June1);
    private readonly SaveSlot save = SaveSlot.Create(Guid.NewGuid(), [1], June1);
    private readonly WildlifeService service;

    public WildlifeServiceTests()
    {
        var catalog = new FakeContentCatalog(
            FakeContentCatalog.Species("lepus_europaeus", "poljski zajec", null, SpeciesGroup.Mammal),
            FakeContentCatalog.Species("lanius_collurio", "rjavi srakoper", null, SpeciesGroup.Bird, Season.Spring, Season.Summer, Season.Autumn),
            FakeContentCatalog.Species("salvia_pratensis", "travniška kadulja"));
        service = new WildlifeService(catalog, time);
    }

    [Fact]
    public void Lists_the_animals_of_a_map_but_no_plants()
    {
        var residents = service.List(save, FakeContentCatalog.MapId);

        Assert.NotNull(residents);
        Assert.Equal(["lanius_collurio", "lepus_europaeus"], residents.Select(r => r.SpotId));
        Assert.All(residents, resident => Assert.True(resident.Present));
        Assert.All(residents, resident => Assert.Equal(TorchReaction.Calm, resident.Torch));
    }

    [Fact]
    public void Animals_out_of_season_are_listed_as_absent()
    {
        time.Advance(TimeSpan.FromSeconds(12960)); // day 10: winter

        var residents = service.List(save, FakeContentCatalog.MapId)!;

        Assert.False(residents.Single(r => r.SpotId == "lanius_collurio").Present);
        Assert.True(residents.Single(r => r.SpotId == "lepus_europaeus").Present);
    }

    [Fact]
    public void An_unknown_map_has_no_list()
    {
        Assert.Null(service.List(save, "other_map"));
    }
}
