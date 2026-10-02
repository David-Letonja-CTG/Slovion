using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEncounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "discovered_at",
                table: "discoveries",
                newName: "observed_at");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "identified_at",
                table: "discoveries",
                type: "timestamp with time zone",
                nullable: true);

            // Discoveries from the walking skeleton were completed without identification: keep them identified.
            migrationBuilder.Sql("UPDATE discoveries SET identified_at = observed_at;");

            migrationBuilder.CreateTable(
                name: "encounters",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    save_slot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    species_id = table.Column<string>(type: "text", nullable: false),
                    map_id = table.Column<string>(type: "text", nullable: false),
                    spot_id = table.Column<string>(type: "text", nullable: false),
                    candidates = table.Column<string[]>(type: "text[]", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_encounters", x => x.id);
                    table.ForeignKey(
                        name: "FK_encounters_save_slots_save_slot_id",
                        column: x => x.save_slot_id,
                        principalTable: "save_slots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_encounters_one_open_per_save_slot",
                table: "encounters",
                column: "save_slot_id",
                unique: true,
                filter: "closed_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "encounters");

            migrationBuilder.DropColumn(
                name: "identified_at",
                table: "discoveries");

            migrationBuilder.RenameColumn(
                name: "observed_at",
                table: "discoveries",
                newName: "discovered_at");
        }
    }
}
