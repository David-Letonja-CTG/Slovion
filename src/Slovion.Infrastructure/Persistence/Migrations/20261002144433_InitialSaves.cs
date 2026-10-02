using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSaves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "save_slots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_save_slots", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "discoveries",
                columns: table => new
                {
                    save_slot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    species_id = table.Column<string>(type: "text", nullable: false),
                    map_id = table.Column<string>(type: "text", nullable: false),
                    spot_id = table.Column<string>(type: "text", nullable: false),
                    discovered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_discoveries", x => new { x.save_slot_id, x.species_id });
                    table.ForeignKey(
                        name: "FK_discoveries_save_slots_save_slot_id",
                        column: x => x.save_slot_id,
                        principalTable: "save_slots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_save_slots_token_hash",
                table: "save_slots",
                column: "token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "discoveries");

            migrationBuilder.DropTable(
                name: "save_slots");
        }
    }
}
