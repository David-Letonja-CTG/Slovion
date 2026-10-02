using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

internal sealed class SaveSlotConfiguration : IEntityTypeConfiguration<SaveSlot>
{
    public void Configure(EntityTypeBuilder<SaveSlot> builder)
    {
        builder.ToTable("save_slots");
        builder.HasKey(slot => slot.Id);
        builder.Property(slot => slot.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(slot => slot.TokenHash).HasColumnName("token_hash").IsRequired();
        builder.Property(slot => slot.CreatedAt).HasColumnName("created_at");
        builder.HasIndex(slot => slot.TokenHash).IsUnique();
    }
}
