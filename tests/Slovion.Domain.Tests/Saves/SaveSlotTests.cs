using Slovion.Domain.Saves;

namespace Slovion.Domain.Tests.Saves;

public class SaveSlotTests
{
    [Fact]
    public void Requires_an_id_and_a_token_hash()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SaveSlot.Create(Guid.Empty, [1], DateTimeOffset.UnixEpoch));
        Assert.Throws<ArgumentOutOfRangeException>(() => SaveSlot.Create(Guid.NewGuid(), [], DateTimeOffset.UnixEpoch));
    }
}
