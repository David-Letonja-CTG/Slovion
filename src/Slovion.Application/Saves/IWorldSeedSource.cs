namespace Slovion.Application.Saves;

/// <summary>World seeds for new saves (D13). Production draws them at random; tests and development may fix them.</summary>
public interface IWorldSeedSource
{
    long NextSeed();
}
