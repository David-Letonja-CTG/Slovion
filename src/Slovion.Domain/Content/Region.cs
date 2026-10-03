namespace Slovion.Domain.Content;

/// <summary>What opens a region for a save. Gameplay data (docs/decisions.md D6).</summary>
public abstract record UnlockRule
{
    private UnlockRule()
    {
    }

    /// <summary>Whether a save with these flags and this many identified species meets the rule.</summary>
    public abstract bool IsMetBy(IReadOnlyCollection<string> flags, int identifiedCount);

    /// <summary>Always open.</summary>
    public sealed record Always : UnlockRule
    {
        public override bool IsMetBy(IReadOnlyCollection<string> flags, int identifiedCount) => true;
    }

    /// <summary>Open once the save holds a flag (a quest reward).</summary>
    public sealed record Flag(string FlagId) : UnlockRule
    {
        public override bool IsMetBy(IReadOnlyCollection<string> flags, int identifiedCount)
        {
            ArgumentNullException.ThrowIfNull(flags);
            return flags.Contains(FlagId);
        }
    }

    /// <summary>Open once the save has identified at least <see cref="Count"/> species.</summary>
    public sealed record IdentifiedSpecies(int Count) : UnlockRule
    {
        public override bool IsMetBy(IReadOnlyCollection<string> flags, int identifiedCount) => identifiedCount >= Count;
    }
}

/// <summary>A region's texts in one language: game labels, not facts.</summary>
public sealed record RegionText(string Name, string LockedHint);

/// <summary>
/// A place the player can travel to: one map, a position on the schematic travel map (percent of its width and
/// height), its order in the travel list, and the rule that opens it (docs/decisions.md D7).
/// </summary>
public sealed record Region(string Id, string MapId, int Order, int X, int Y, UnlockRule Unlock, IReadOnlyDictionary<string, RegionText> Text)
{
    /// <summary>The region every new save starts in; content must define it.</summary>
    public const string StartId = "dravsko_polje";

    public bool IsUnlockedFor(IReadOnlyCollection<string> flags, int identifiedCount) => Unlock.IsMetBy(flags, identifiedCount);
}
