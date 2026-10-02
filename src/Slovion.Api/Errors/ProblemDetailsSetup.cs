namespace Slovion.Api.Errors;

public static class ProblemDetailsSetup
{
    /// <summary>Registers problem details and guarantees every problem carries a <c>code</c>.</summary>
    public static IServiceCollection AddSlovionProblemDetails(this IServiceCollection services) =>
        services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
            context.ProblemDetails.Extensions.TryAdd(
                ErrorCodes.ExtensionName,
                ErrorCodes.FromStatusCode(context.ProblemDetails.Status)));

    /// <summary>Unmatched routes under <c>/api</c> return a 404 problem instead of an empty response.</summary>
    public static IEndpointRouteBuilder MapApiNotFoundFallback(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapFallback("/api/{**path}", () => Results.Problem(statusCode: StatusCodes.Status404NotFound));
        return endpoints;
    }
}
