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

    [Fact]
    public void A_new_save_starts_on_dravsko_polje()
    {
        Assert.Equal("dravsko_polje", SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch).RegionId);
    }

    [Fact]
    public void Travelling_changes_the_current_region()
    {
        var slot = SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch);

        slot.TravelTo("kocevje");

        Assert.Equal("kocevje", slot.RegionId);
        Assert.Throws<ArgumentException>(() => slot.TravelTo(" "));
    }
}
