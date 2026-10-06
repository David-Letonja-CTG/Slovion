using Slovion.Api.Content;
using Slovion.Api.Discovery;
using Slovion.Api.Errors;
using Slovion.Api.Quests;
using Slovion.Api.Saves;
using Slovion.Api.Stations;
using Slovion.Api.Travel;
using Slovion.Api.Wildlife;
using Slovion.Api.World;
using Slovion.Application.Discovery;
using Slovion.Application.Quests;
using Slovion.Application.Saves;
using Slovion.Application.Stations;
using Slovion.Application.Travel;
using Slovion.Application.Weather;
using Slovion.Application.Wildlife;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSlovionProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.IsDevelopment());
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<SaveSlotService>();
builder.Services.AddScoped<EncounterService>();
builder.Services.AddScoped<NatureDexService>();
builder.Services.AddScoped<ProgressReader>();
builder.Services.AddScoped<QuestService>();
builder.Services.AddScoped<TravelService>();
builder.Services.AddScoped<WeatherService>();
builder.Services.AddScoped<WildlifeService>();
builder.Services.AddScoped<StationService>();

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
app.MapSaveEndpoints().MapDiscoveryEndpoints().MapQuestEndpoints().MapTimeEndpoints().MapWildlifeEndpoints().MapTravelEndpoints().MapWeatherEndpoints().MapStationEndpoints().MapMapEndpoints();
app.MapApiNotFoundFallback();

await app.RunAsync();
