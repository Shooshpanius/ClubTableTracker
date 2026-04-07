using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddClubSocialContacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VkUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InstagramUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "YouTubeUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscordUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebsiteUrl",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "Clubs",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "Clubs",
                type: "longtext",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "VkUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "TelegramUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "InstagramUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "WhatsAppUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "YouTubeUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "DiscordUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "WebsiteUrl", table: "Clubs");
            migrationBuilder.DropColumn(name: "ContactEmail", table: "Clubs");
            migrationBuilder.DropColumn(name: "ContactPhone", table: "Clubs");
        }
    }
}
