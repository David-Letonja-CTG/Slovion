namespace Slovion.Domain.Content;

/// <summary>Broad group of a species; drives labels such as "Čas cvetenja" vs "Čas letanja".</summary>
public enum SpeciesGroup
{
    Plant,
    Mammal,
    Bird,
    Insect,
}

public static class SpeciesGroups
{
    private static readonly Dictionary<string, SpeciesGroup> ByName = new(StringComparer.Ordinal)
    {
        ["plant"] = SpeciesGroup.Plant,
        ["mammal"] = SpeciesGroup.Mammal,
        ["bird"] = SpeciesGroup.Bird,
        ["insect"] = SpeciesGroup.Insect,
    };

    /// <summary>Parses the lowercase name used in content and the API.</summary>
    public static bool TryParse(string? name, out SpeciesGroup group) =>
        ByName.TryGetValue(name ?? string.Empty, out group);

    /// <summary>The lowercase name used in content and the API (e.g. <c>plant</c>).</summary>
    public static string ToName(this SpeciesGroup group) =>
        ByName.First(pair => pair.Value == group).Key;
}
