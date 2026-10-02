using Testcontainers.PostgreSql;

namespace Slovion.IntegrationTests.Infrastructure;

/// <summary>Starts one PostgreSQL container shared by all tests in the <see cref="DatabaseCollectionDefinition"/>.</summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer container = new PostgreSqlBuilder("postgres:18").Build();

    public string ConnectionString => container.GetConnectionString();

    public async ValueTask InitializeAsync() => await container.StartAsync();

    public async ValueTask DisposeAsync() => await container.DisposeAsync();
}

[CollectionDefinition(Name)]
public sealed class DatabaseCollectionDefinition : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Database";
}
