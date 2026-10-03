namespace Slovion.Api.Errors;

/// <summary>
/// Stable, machine-readable error codes returned in the problem-details <c>code</c> extension.
/// The client maps codes to translation keys; the API never returns player-facing prose.
/// </summary>
public static class ErrorCodes
{
    public const string ExtensionName = "code";

    public const string BadRequest = "bad_request";
    public const string NotFound = "not_found";
    public const string MethodNotAllowed = "method_not_allowed";
    public const string Conflict = "conflict";
    public const string InternalError = "internal_error";
    public const string Unknown = "error";

    public const string InvalidSaveToken = "invalid_save_token";
    public const string UnknownSpot = "unknown_spot";
    public const string UnknownEncounter = "unknown_encounter";
    public const string UnknownHabitat = "unknown_habitat";
    public const string UnknownNpc = "unknown_npc";
    public const string UnknownMap = "unknown_map";

    public static string FromStatusCode(int? statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => BadRequest,
        StatusCodes.Status404NotFound => NotFound,
        StatusCodes.Status405MethodNotAllowed => MethodNotAllowed,
        StatusCodes.Status409Conflict => Conflict,
        >= 500 => InternalError,
        _ => Unknown,
    };

    /// <summary>A problem response with an explicit code.</summary>
    public static IResult Problem(int statusCode, string code) =>
        TypedResults.Problem(statusCode: statusCode, extensions: new Dictionary<string, object?> { [ExtensionName] = code });
}
