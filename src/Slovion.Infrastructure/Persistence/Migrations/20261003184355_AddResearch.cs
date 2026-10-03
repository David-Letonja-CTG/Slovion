using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddResearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "research_level",
                table: "discoveries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "researched_at",
                table: "discoveries",
                type: "timestamp with time zone",
                nullable: true);

            // Species identified before research existed start at level 1, researched when they were identified.
            migrationBuilder.Sql("UPDATE discoveries SET research_level = 1, researched_at = identified_at WHERE identified_at IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "research_level",
                table: "discoveries");

            migrationBuilder.DropColumn(
                name: "researched_at",
                table: "discoveries");
        }
    }
}
