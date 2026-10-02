using Slovion.Application.Discovery;
using Slovion.Domain.Content;

namespace Slovion.Application.Tests.Discovery;

public class CandidateSelectorTests
{
    private static readonly SpeciesId[] Five =
    [
        SpeciesId.Parse("salvia_pratensis"),
        SpeciesId.Parse("taraxacum_officinale"),
        SpeciesId.Parse("lepus_europaeus"),
        SpeciesId.Parse("alauda_arvensis"),
        SpeciesId.Parse("papilio_machaon"),
    ];

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(42)]
    public void Offers_four_distinct_species_including_the_correct_one(int seed)
    {
        var candidates = CandidateSelector.Choose(Five[1], Five, new SeededRandom(seed));

        Assert.Equal(4, candidates.Count);
        Assert.Equal(4, candidates.Distinct().Count());
        Assert.Single(candidates, id => id == Five[1]);
        Assert.All(candidates, id => Assert.Contains(id, Five));
    }

    [Fact]
    public void Is_deterministic_for_a_seed()
    {
        var first = CandidateSelector.Choose(Five[0], Five, new SeededRandom(7));
        var second = CandidateSelector.Choose(Five[0], Five.Reverse(), new SeededRandom(7));

        Assert.Equal(first, second); // independent of catalog order too
    }

    [Fact]
    public void Varies_with_the_seed()
    {
        var orders = Enumerable.Range(0, 20)
            .Select(seed => string.Join(",", CandidateSelector.Choose(Five[0], Five, new SeededRandom(seed))))
            .Distinct()
            .Count();

        Assert.True(orders > 1);
    }

    [Fact]
    public void Offers_every_species_when_fewer_than_four_exist()
    {
        var candidates = CandidateSelector.Choose(Five[0], Five[..3], new SeededRandom(1));

        Assert.Equal(Five[..3].OrderBy(id => id.Value), candidates.OrderBy(id => id.Value));
    }
}
