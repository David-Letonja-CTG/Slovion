using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Domain.Tests.Discovery;

public class EncounterTests
{
    private static readonly SpeciesId Sage = SpeciesId.Parse("salvia_pratensis");
    private static readonly SpeciesId Dandelion = SpeciesId.Parse("taraxacum_officinale");
    private static readonly SpeciesId Hare = SpeciesId.Parse("lepus_europaeus");
    private static readonly MapSpot SageSpot = new("dravsko_polje_meadow", "meadow_sage_1", Sage);

    private static Encounter Start(params SpeciesId[] candidates) =>
        Encounter.Start(Guid.NewGuid(), Guid.NewGuid(), SageSpot, candidates, DateTimeOffset.UnixEpoch);

    [Fact]
    public void Starts_open_with_the_spot_species_as_the_answer()
    {
        var encounter = Start(Hare, Sage, Dandelion);

        Assert.True(encounter.IsOpen);
        Assert.Equal(Sage, encounter.SpeciesId);
        Assert.Equal([Hare, Sage, Dandelion], encounter.Candidates);
    }

    [Fact]
    public void Judges_answers_and_knows_its_candidates()
    {
        var encounter = Start(Hare, Sage);

        Assert.True(encounter.IsCorrect(Sage));
        Assert.False(encounter.IsCorrect(Hare));
        Assert.True(encounter.IsCandidate(Hare));
        Assert.False(encounter.IsCandidate(Dandelion));
    }

    [Fact]
    public void Requires_the_answer_among_distinct_candidates()
    {
        Assert.Throws<ArgumentException>(() => Start(Hare, Dandelion));
        Assert.Throws<ArgumentException>(() => Start(Sage, Sage, Hare));
        Assert.Throws<ArgumentException>(() => Start(Sage));
    }
}
