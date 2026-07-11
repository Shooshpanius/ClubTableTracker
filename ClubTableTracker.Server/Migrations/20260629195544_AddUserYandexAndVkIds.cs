using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserYandexAndVkIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VkId",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "YandexId",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Users_VkId",
                table: "Users",
                column: "VkId",
                unique: true,
                filter: "`VkId` IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Users_YandexId",
                table: "Users",
                column: "YandexId",
                unique: true,
                filter: "`YandexId` IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_VkId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_YandexId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "VkId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "YandexId",
                table: "Users");
        }
    }
}
