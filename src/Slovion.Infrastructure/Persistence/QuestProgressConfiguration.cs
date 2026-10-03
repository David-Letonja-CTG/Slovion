using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Slovion.Domain.Quests;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

internal sealed class QuestProgressConfiguration : IEntityTypeConfiguration<QuestProgress>
{
    public void Configure(EntityTypeBuilder<QuestProgress> builder)
    {
        builder.ToTable("quest_progress");

        // One record per quest and save slot; the key also makes concurrent duplicates impossible.
        builder.HasKey(progress => new { progress.SaveSlotId, progress.QuestId });
        builder.Property(progress => progress.SaveSlotId).HasColumnName("save_slot_id");
        builder.Property(progress => progress.QuestId).HasColumnName("quest_id");
        builder.Property(progress => progress.StartedAt).HasColumnName("started_at");
        builder.Property(progress => progress.CompletedAt).HasColumnName("completed_at");
        builder.Ignore(progress => progress.IsCompleted);

        builder.HasOne<SaveSlot>()
            .WithMany()
            .HasForeignKey(progress => progress.SaveSlotId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
