using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddManualParticipant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingParticipants_Users_UserId",
                table: "BookingParticipants");

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "BookingParticipants",
                type: "varchar(255)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "ManualMembershipId",
                table: "BookingParticipants",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ManualName",
                table: "BookingParticipants",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BookingParticipants_ManualMembershipId",
                table: "BookingParticipants",
                column: "ManualMembershipId");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingParticipants_Memberships_ManualMembershipId",
                table: "BookingParticipants",
                column: "ManualMembershipId",
                principalTable: "Memberships",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingParticipants_Users_UserId",
                table: "BookingParticipants",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BookingParticipants_Memberships_ManualMembershipId",
                table: "BookingParticipants");

            migrationBuilder.DropForeignKey(
                name: "FK_BookingParticipants_Users_UserId",
                table: "BookingParticipants");

            migrationBuilder.DropIndex(
                name: "IX_BookingParticipants_ManualMembershipId",
                table: "BookingParticipants");

            migrationBuilder.DropColumn(
                name: "ManualMembershipId",
                table: "BookingParticipants");

            migrationBuilder.DropColumn(
                name: "ManualName",
                table: "BookingParticipants");

            migrationBuilder.UpdateData(
                table: "BookingParticipants",
                keyColumn: "UserId",
                keyValue: null,
                column: "UserId",
                value: "");

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                table: "BookingParticipants",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddForeignKey(
                name: "FK_BookingParticipants_Users_UserId",
                table: "BookingParticipants",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
