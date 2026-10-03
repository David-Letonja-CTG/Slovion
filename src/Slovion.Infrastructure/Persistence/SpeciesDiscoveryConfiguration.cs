using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

internal sealed class SpeciesDiscoveryConfiguration : IEntityTypeConfiguration<SpeciesDiscovery>
{
    public void Configure(EntityTypeBuilder<SpeciesDiscovery> builder)
    {
        builder.ToTable("discoveries");

        // One discovery per species and save slot; the key also makes concurrent duplicates impossible.
        builder.HasKey(discovery => new { discovery.SaveSlotId, discovery.SpeciesId });
        builder.Property(discovery => discovery.SaveSlotId).HasColumnName("save_slot_id");
        builder.Property(discovery => discovery.SpeciesId)
            .HasColumnName("species_id")
            .HasConversion(id => id.Value, value => SpeciesId.Parse(value));
        builder.Property(discovery => discovery.MapId).HasColumnName("map_id").IsRequired();
        builder.Property(discovery => discovery.SpotId).HasColumnName("spot_id");
        builder.Property(discovery => discovery.HabitatId).HasColumnName("habitat_id");
        builder.Property(discovery => discovery.ObservedAt).HasColumnName("observed_at");
        builder.Property(discovery => discovery.IdentifiedAt).HasColumnName("identified_at");
        builder.Property(discovery => discovery.ResearchLevel).HasColumnName("research_level");
        builder.Property(discovery => discovery.ResearchedAt).HasColumnName("researched_at");
        builder.Ignore(discovery => discovery.IsIdentified);

        builder.HasOne<SaveSlot>()
            .WithMany()
            .HasForeignKey(discovery => discovery.SaveSlotId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
