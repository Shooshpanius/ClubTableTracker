using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingParticipantStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "BookingParticipants",
                type: "longtext",
                nullable: false,
                defaultValue: "Accepted")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "BookingParticipants");
        }
    }
}
