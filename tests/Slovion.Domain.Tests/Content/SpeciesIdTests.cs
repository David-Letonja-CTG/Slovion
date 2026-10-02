using Slovion.Domain.Content;

namespace Slovion.Domain.Tests.Content;

public class SpeciesIdTests
{
    [Theory]
    [InlineData("salvia_pratensis")]
    [InlineData("vulpes_vulpes")]
    public void Accepts_lowercase_genus_species(string value)
    {
        var id = SpeciesId.Parse(value);

        Assert.Equal(value, id.Value);
    }

    [Theory]
    [InlineData("Salvia-Pratensis")]
    [InlineData("Salvia_pratensis")]
    [InlineData("salvia")]
    [InlineData("salvia_pratensis_subsp")]
    [InlineData("salvia pratensis")]
    [InlineData("kadulja_č")]
    [InlineData("")]
    public void Rejects_anything_else(string value)
    {
        Assert.False(SpeciesId.IsValid(value));
        var error = Assert.Throws<FormatException>(() => SpeciesId.Parse(value));
        Assert.Contains(value, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Equal_values_are_equal_ids()
    {
        Assert.Equal(SpeciesId.Parse("salvia_pratensis"), SpeciesId.Parse("salvia_pratensis"));
    }
}
