using Slovion.Application.Saves;

namespace Slovion.Api.Saves;

public sealed record CreatedSaveResponse(string Token);

public static class SaveEndpoints
{
    /// <summary>Maps <c>POST /api/saves</c> and returns the <c>/api/save</c> group that requires a save token.</summary>
    public static RouteGroupBuilder MapSaveEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/saves", async (SaveSlotService saveSlots, CancellationToken cancellationToken) =>
                TypedResults.Json(
                    new CreatedSaveResponse(await saveSlots.CreateAsync(cancellationToken)),
                    statusCode: StatusCodes.Status201Created))
            .WithName("CreateSave")
            .Produces<CreatedSaveResponse>(StatusCodes.Status201Created);

        return endpoints.MapGroup("/api/save")
            .AddEndpointFilter<SaveTokenFilter>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);
    }
}
