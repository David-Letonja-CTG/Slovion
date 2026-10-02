using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHabitatSearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "spot_id",
                table: "encounters",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "habitat_id",
                table: "encounters",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "spot_id",
                table: "discoveries",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "habitat_id",
                table: "discoveries",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "habitat_id",
                table: "encounters");

            migrationBuilder.DropColumn(
                name: "habitat_id",
                table: "discoveries");

            migrationBuilder.AlterColumn<string>(
                name: "spot_id",
                table: "encounters",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "spot_id",
                table: "discoveries",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
