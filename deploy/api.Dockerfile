# syntax=docker/dockerfile:1
# The Slovion API with the game content (docs/decisions.md D7). Build from the repository root:
#   docker buildx build -f deploy/api.Dockerfile --platform linux/arm64,linux/amd64 .
# The SDK stage runs on the build machine and cross-compiles for the target, so no CPU emulation is needed.

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /repo

# Restore first, so package downloads are cached until a project file changes.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/Slovion.Domain/Slovion.Domain.csproj src/Slovion.Domain/
COPY src/Slovion.Application/Slovion.Application.csproj src/Slovion.Application/
COPY src/Slovion.Infrastructure/Slovion.Infrastructure.csproj src/Slovion.Infrastructure/
COPY src/Slovion.Api/Slovion.Api.csproj src/Slovion.Api/
# .NET names the x86-64 architecture x64; Docker calls it amd64.
RUN arch=$([ "$TARGETARCH" = amd64 ] && echo x64 || echo "$TARGETARCH") \
 && dotnet restore src/Slovion.Api/Slovion.Api.csproj -a "$arch"

COPY src/ src/
COPY content/ content/
RUN arch=$([ "$TARGETARCH" = amd64 ] && echo x64 || echo "$TARGETARCH") \
 && dotnet publish src/Slovion.Api/Slovion.Api.csproj -c Release -a "$arch" --no-restore -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
EXPOSE 8080
USER $APP_UID
# The image has no curl; bash's /dev/tcp asks the API's own health endpoint.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -n 1 <&3 | grep -q ' 200 '"]
ENTRYPOINT ["dotnet", "Slovion.Api.dll"]
