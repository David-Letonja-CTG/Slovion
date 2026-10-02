using Microsoft.EntityFrameworkCore;

namespace Slovion.Infrastructure.Persistence;

/// <summary>Stores player state. Game content is not stored here (see docs/decisions.md D7).</summary>
public sealed class SlovionDbContext(DbContextOptions<SlovionDbContext> options) : DbContext(options);
