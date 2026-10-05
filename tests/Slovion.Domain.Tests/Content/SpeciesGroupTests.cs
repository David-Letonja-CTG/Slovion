using Slovion.Domain.Content;

namespace Slovion.Domain.Tests.Content;

public class SpeciesGroupTests
{
    [Theory]
    [InlineData("plant", SpeciesGroup.Plant)]
    [InlineData("amphibian", SpeciesGroup.Amphibian)]
    [InlineData("fish", SpeciesGroup.Fish)]
    [InlineData("mollusc", SpeciesGroup.Mollusc)]
    public void Groups_parse_from_and_print_to_their_content_names(string name, SpeciesGroup expected)
    {
        Assert.True(SpeciesGroups.TryParse(name, out var group));
        Assert.Equal(expected, group);
        Assert.Equal(name, group.ToName());
    }

    [Theory]
    [InlineData("fungus")]
    [InlineData("Fish")]
    [InlineData(null)]
    public void Other_names_are_not_groups(string? name)
    {
        Assert.False(SpeciesGroups.TryParse(name, out _));
    }
}
