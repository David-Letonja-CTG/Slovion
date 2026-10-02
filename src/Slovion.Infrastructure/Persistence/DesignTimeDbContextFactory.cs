using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Slovion.Infrastructure.Persistence;

/// <summary>Lets <c>dotnet ef</c> create migrations without starting the API (no database needed).</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SlovionDbContext>
{
    public SlovionDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<SlovionDbContext>()
            .UseNpgsql("Host=localhost;Database=slovion_design_time")
            .Options);
}
