using System.Text;

namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// The only randomness of world generation: SplitMix64, seeded explicitly, so the same seed always gives the same
/// sequence on every machine (design §2). Never use <see cref="Random"/> or a clock in generation.
/// </summary>
public sealed class WorldRandom
{
    private readonly ulong seed;
    private ulong state;

    public WorldRandom(ulong seed)
    {
        this.seed = seed;
        state = seed;
    }

    /// <summary>A separate stream named <paramref name="name"/>, derived from this one's seed (not its position).</summary>
    public WorldRandom Fork(string name) => new(SeedHash.Combine(seed, name));

    public ulong NextUInt64()
    {
        state = unchecked(state + 0x9E3779B97F4A7C15UL);
        return SeedHash.Mix(state);
    }

    /// <summary>A non-negative integer less than <paramref name="maxExclusive"/>.</summary>
    public int Next(int maxExclusive)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxExclusive);
        return (int)(NextUInt64() % (ulong)maxExclusive);
    }

    /// <summary>An integer from <paramref name="min"/> to <paramref name="maxInclusive"/>.</summary>
    public int Range(int min, int maxInclusive) => min + Next(maxInclusive - min + 1);

    /// <summary>A number in [0, 1).</summary>
    public double NextDouble() => (NextUInt64() >> 11) * (1.0 / (1UL << 53));

    public bool Chance(double probability) => NextDouble() < probability;

    public T Pick<T>(IReadOnlyList<T> items)
    {
        ArgumentNullException.ThrowIfNull(items);
        return items[Next(items.Count)];
    }
}

/// <summary>64-bit FNV-1a hashing and mixing for generation seeds (the same family as the weather's, D11).</summary>
public static class SeedHash
{
    /// <summary>64-bit FNV-1a over the UTF-8 bytes of <paramref name="text"/>.</summary>
    public static ulong Of(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var hash = 14695981039346656037UL;
        foreach (var b in Encoding.UTF8.GetBytes(text))
        {
            hash = unchecked((hash ^ b) * 1099511628211UL);
        }

        return hash;
    }

    /// <summary>A seed for the stream <paramref name="name"/> of <paramref name="seed"/>.</summary>
    public static ulong Combine(ulong seed, string name) => Mix(seed ^ Of(name));

    /// <summary>The SplitMix64 finalizer: spreads every input bit over the output.</summary>
    public static ulong Mix(ulong value)
    {
        unchecked
        {
            value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
            value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;
            return value ^ (value >> 31);
        }
    }
}
