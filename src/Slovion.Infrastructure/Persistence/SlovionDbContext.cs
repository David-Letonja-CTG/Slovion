using Microsoft.EntityFrameworkCore;
using Slovion.Domain.Discovery;
using Slovion.Domain.Quests;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

/// <summary>Stores player state. Game content is not stored here (see docs/decisions.md D7).</summary>
public sealed class SlovionDbContext(DbContextOptions<SlovionDbContext> options) : DbContext(options)
{
    public DbSet<SaveSlot> SaveSlots => Set<SaveSlot>();

    public DbSet<SpeciesDiscovery> Discoveries => Set<SpeciesDiscovery>();

    public DbSet<Encounter> Encounters => Set<Encounter>();

    public DbSet<QuestProgress> QuestProgress => Set<QuestProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SlovionDbContext).Assembly);
}
