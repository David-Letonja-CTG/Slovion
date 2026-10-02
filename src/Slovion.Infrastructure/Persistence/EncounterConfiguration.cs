using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

internal sealed class EncounterConfiguration : IEntityTypeConfiguration<Encounter>
{
    public void Configure(EntityTypeBuilder<Encounter> builder)
    {
        builder.ToTable("encounters");
        builder.HasKey(encounter => encounter.Id);
        builder.Property(encounter => encounter.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(encounter => encounter.SaveSlotId).HasColumnName("save_slot_id");
        builder.Property(encounter => encounter.SpeciesId)
            .HasColumnName("species_id")
            .HasConversion(id => id.Value, value => SpeciesId.Parse(value));
        builder.Property(encounter => encounter.MapId).HasColumnName("map_id").IsRequired();
        builder.Property(encounter => encounter.SpotId).HasColumnName("spot_id").IsRequired();
        builder.Property(encounter => encounter.Candidates)
            .HasColumnName("candidates")
            .HasColumnType("text[]")
            .HasConversion(
                candidates => candidates.Select(id => id.Value).ToArray(),
                values => values.Select(SpeciesId.Parse).ToList(),
                new ValueComparer<IReadOnlyList<SpeciesId>>(
                    (left, right) => left!.SequenceEqual(right!),
                    candidates => candidates.Aggregate(0, (hash, id) => HashCode.Combine(hash, id)),
                    candidates => candidates.ToList()));
        builder.Property(encounter => encounter.CreatedAt).HasColumnName("created_at");
        builder.Property(encounter => encounter.ClosedAt).HasColumnName("closed_at");
        builder.Ignore(encounter => encounter.IsOpen);

        // The database guarantees at most one open encounter per save slot.
        builder.HasIndex(encounter => encounter.SaveSlotId)
            .IsUnique()
            .HasFilter("closed_at IS NULL")
            .HasDatabaseName("ix_encounters_one_open_per_save_slot");

        builder.HasOne<SaveSlot>()
            .WithMany()
            .HasForeignKey(encounter => encounter.SaveSlotId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
