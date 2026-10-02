using Slovion.Api.Content;
using Slovion.Api.Discovery;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Discovery;
using Slovion.Application.Saves;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSlovionProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<SaveSlotService>();
builder.Services.AddScoped<DiscoveryService>();

var app = builder.Build();

if (app.Configuration.GetValue(DatabaseMigration.MigrateOnStartupSetting, defaultValue: true))
{
    await app.Services.MigrateDatabaseAsync();
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UsePublicContentFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health");
app.MapSaveEndpoints().MapDiscoveryEndpoints();
app.MapApiNotFoundFallback();

await app.RunAsync();
