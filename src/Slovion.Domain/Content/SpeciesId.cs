using System.Text.RegularExpressions;

namespace Slovion.Domain.Content;

/// <summary>
/// Stable, language-independent species identity of the form <c>genus_species</c>
/// (e.g. <c>salvia_pratensis</c>). It never changes, even if the scientific name is revised.
/// </summary>
public readonly partial record struct SpeciesId
{
    public string Value { get; }

    private SpeciesId(string value) => Value = value;

    public static bool IsValid(string? value) => value is not null && Pattern().IsMatch(value);

    public static SpeciesId Parse(string value) =>
        IsValid(value)
            ? new SpeciesId(value)
            : throw new FormatException($"'{value}' is not a valid species ID (expected genus_species in lowercase ASCII).");

    public override string ToString() => Value;

    [GeneratedRegex("^[a-z]+_[a-z]+$")]
    private static partial Regex Pattern();
}
