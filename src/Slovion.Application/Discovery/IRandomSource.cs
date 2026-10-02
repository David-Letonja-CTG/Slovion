namespace Slovion.Application.Discovery;

/// <summary>Randomness for gameplay decisions; seeded in tests so outcomes are deterministic.</summary>
public interface IRandomSource
{
    /// <summary>A non-negative integer less than <paramref name="maxExclusive"/>.</summary>
    int NextIndex(int maxExclusive);
}
