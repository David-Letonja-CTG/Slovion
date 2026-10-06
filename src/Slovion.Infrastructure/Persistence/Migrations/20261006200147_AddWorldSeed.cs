using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorldSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "world_seed",
                table: "save_slots",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "world_version",
                table: "save_slots",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            // Saves made before generated worlds (D13) get a seed derived from their ID, so each keeps its own world.
            migrationBuilder.Sql("UPDATE save_slots SET world_seed = ('x' || substr(md5(id::text), 1, 16))::bit(64)::bigint;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "world_seed",
                table: "save_slots");

            migrationBuilder.DropColumn(
                name: "world_version",
                table: "save_slots");
        }
    }
}
