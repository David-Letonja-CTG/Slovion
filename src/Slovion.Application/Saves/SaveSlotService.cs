using Slovion.Domain.Saves;

namespace Slovion.Application.Saves;

public sealed class SaveSlotService(ISaveSlotRepository saveSlots, TimeProvider time)
{
    /// <summary>Creates an empty save slot and returns its token. The token is not stored.</summary>
    public async Task<string> CreateAsync(CancellationToken cancellationToken)
    {
        var token = SaveToken.Generate();
        var slot = SaveSlot.Create(Guid.NewGuid(), SaveToken.Hash(token), time.GetUtcNow());
        await saveSlots.AddAsync(slot, cancellationToken);
        return token;
    }

    /// <summary>The slot for a token, or <c>null</c> when the token is unknown.</summary>
    public Task<SaveSlot?> ResolveAsync(string token, CancellationToken cancellationToken) =>
        saveSlots.FindByTokenHashAsync(SaveToken.Hash(token), cancellationToken);
}
