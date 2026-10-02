using System.Reflection;
using NetArchTest.Rules;
using Slovion.Application;
using Slovion.Domain;
using Slovion.Infrastructure;

namespace Slovion.ArchitectureTests;

public class LayerDependencyTests
{
    private const string ApplicationNamespace = "Slovion.Application";
    private const string InfrastructureNamespace = "Slovion.Infrastructure";
    private const string ApiNamespace = "Slovion.Api";
    private const string EntityFrameworkNamespace = "Microsoft.EntityFrameworkCore";
    private const string AspNetCoreNamespace = "Microsoft.AspNetCore";

    private static readonly Assembly DomainLayer = typeof(DomainAssembly).Assembly;
    private static readonly Assembly ApplicationLayer = typeof(ApplicationAssembly).Assembly;
    private static readonly Assembly InfrastructureLayer = typeof(InfrastructureAssembly).Assembly;

    [Fact]
    public void Domain_does_not_depend_on_other_layers_or_frameworks()
    {
        var result = Types.InAssembly(DomainLayer)
            .ShouldNot()
            .HaveDependencyOnAny(
                ApplicationNamespace,
                InfrastructureNamespace,
                ApiNamespace,
                EntityFrameworkNamespace,
                AspNetCoreNamespace)
            .GetResult();

        AssertSuccessful(result);
    }

    [Fact]
    public void Application_depends_only_on_domain()
    {
        var result = Types.InAssembly(ApplicationLayer)
            .ShouldNot()
            .HaveDependencyOnAny(
                InfrastructureNamespace,
                ApiNamespace,
                EntityFrameworkNamespace,
                AspNetCoreNamespace)
            .GetResult();

        AssertSuccessful(result);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_api()
    {
        var result = Types.InAssembly(InfrastructureLayer)
            .ShouldNot()
            .HaveDependencyOn(ApiNamespace)
            .GetResult();

        AssertSuccessful(result);
    }

    private static void AssertSuccessful(NetArchTest.Rules.TestResult result)
    {
        var offenders = result.FailingTypeNames ?? [];
        Assert.True(result.IsSuccessful, $"Forbidden dependencies in: {string.Join(", ", offenders)}");
    }
}
