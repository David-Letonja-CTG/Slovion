using Slovion.Api.Errors;
using Slovion.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSlovionProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health");
app.MapApiNotFoundFallback();

app.Run();
