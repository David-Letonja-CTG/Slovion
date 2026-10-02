using Slovion.Application.Discovery;

namespace Slovion.Infrastructure;

/// <summary>Production randomness. Tests replace <see cref="IRandomSource"/> with a seeded one.</summary>
internal sealed class SystemRandomSource : IRandomSource
{
    public int NextIndex(int maxExclusive) => Random.Shared.Next(maxExclusive);
}
