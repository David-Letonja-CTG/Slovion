using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Slovion.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "quest_progress",
                columns: table => new
                {
                    save_slot_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quest_id = table.Column<string>(type: "text", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quest_progress", x => new { x.save_slot_id, x.quest_id });
                    table.ForeignKey(
                        name: "FK_quest_progress_save_slots_save_slot_id",
                        column: x => x.save_slot_id,
                        principalTable: "save_slots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quest_progress");
        }
    }
}
