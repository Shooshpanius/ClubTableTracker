using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddClubEventGameMaster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GameMasterId",
                table: "ClubEvents",
                type: "varchar(255)",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ClubEvents_GameMasterId",
                table: "ClubEvents",
                column: "GameMasterId");

            migrationBuilder.AddForeignKey(
                name: "FK_ClubEvents_Users_GameMasterId",
                table: "ClubEvents",
                column: "GameMasterId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClubEvents_Users_GameMasterId",
                table: "ClubEvents");

            migrationBuilder.DropIndex(
                name: "IX_ClubEvents_GameMasterId",
                table: "ClubEvents");

            migrationBuilder.DropColumn(
                name: "GameMasterId",
                table: "ClubEvents");
        }
    }
}
