using Slovion.Domain.Content;

namespace Slovion.Application.Discovery;

/// <summary>Chooses the species offered in an encounter (docs/decisions.md D1: three to four candidates).</summary>
public static class CandidateSelector
{
    public const int CandidateCount = 4;

    /// <summary>
    /// The correct species plus up to three others, in random order. Other species are sorted first,
    /// so the result depends only on the random source, not on catalog order.
    /// </summary>
    public static IReadOnlyList<SpeciesId> Choose(SpeciesId correct, IEnumerable<SpeciesId> allSpecies, IRandomSource random)
    {
        ArgumentNullException.ThrowIfNull(allSpecies);
        ArgumentNullException.ThrowIfNull(random);

        var others = allSpecies
            .Where(id => id != correct)
            .Distinct()
            .OrderBy(id => id.Value, StringComparer.Ordinal)
            .ToList();
        Shuffle(others, random);

        var candidates = others.Take(CandidateCount - 1).Append(correct).ToList();
        Shuffle(candidates, random);
        return candidates;
    }

    /// <summary>Fisher–Yates shuffle.</summary>
    private static void Shuffle<T>(List<T> items, IRandomSource random)
    {
        for (var i = items.Count - 1; i > 0; i--)
        {
            var j = random.NextIndex(i + 1);
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
}
