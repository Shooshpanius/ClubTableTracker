using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddEventStartEndTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Date",
                table: "ClubEvents",
                newName: "StartTime");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndTime",
                table: "ClubEvents",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // MySQL-specific: set EndTime = StartTime + 1 hour for existing events
            migrationBuilder.Sql("UPDATE ClubEvents SET EndTime = DATE_ADD(StartTime, INTERVAL 1 HOUR)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "ClubEvents");

            migrationBuilder.RenameColumn(
                name: "StartTime",
                table: "ClubEvents",
                newName: "Date");
        }
    }
}
