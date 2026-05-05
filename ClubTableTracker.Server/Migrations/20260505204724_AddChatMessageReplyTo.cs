using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageReplyTo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReplyToId",
                table: "ChatMessages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ReplyToId",
                table: "ChatMessages",
                column: "ReplyToId");

            migrationBuilder.AddForeignKey(
                name: "FK_ChatMessages_ChatMessages_ReplyToId",
                table: "ChatMessages",
                column: "ReplyToId",
                principalTable: "ChatMessages",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChatMessages_ChatMessages_ReplyToId",
                table: "ChatMessages");

            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_ReplyToId",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "ReplyToId",
                table: "ChatMessages");
        }
    }
}
