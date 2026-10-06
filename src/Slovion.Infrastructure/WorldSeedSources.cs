using System.Buffers.Binary;
using System.Security.Cryptography;
using Slovion.Application.Saves;

namespace Slovion.Infrastructure;

/// <summary>Production world seeds: random, so every new save gets its own world (D13).</summary>
internal sealed class RandomWorldSeedSource : IWorldSeedSource
{
    public long NextSeed()
    {
        Span<byte> bytes = stackalloc byte[8];
        RandomNumberGenerator.Fill(bytes);
        return BinaryPrimitives.ReadInt64LittleEndian(bytes);
    }
}

/// <summary>One world seed for every new save; for development and end-to-end tests only (never production).</summary>
internal sealed class FixedWorldSeedSource(long seed) : IWorldSeedSource
{
    public long NextSeed() => seed;
}
