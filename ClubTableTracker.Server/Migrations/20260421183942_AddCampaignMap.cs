using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddCampaignMap : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CampaignMaps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    MaxInfluence = table.Column<int>(type: "int", nullable: false),
                    Factions = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignMaps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignMaps_ClubEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "ClubEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CampaignMapBlocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    MapId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PosX = table.Column<double>(type: "double", nullable: false),
                    PosY = table.Column<double>(type: "double", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignMapBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignMapBlocks_CampaignMaps_MapId",
                        column: x => x.MapId,
                        principalTable: "CampaignMaps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CampaignMapBlockFactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    BlockId = table.Column<int>(type: "int", nullable: false),
                    FactionIndex = table.Column<int>(type: "int", nullable: false),
                    Influence = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignMapBlockFactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignMapBlockFactions_CampaignMapBlocks_BlockId",
                        column: x => x.BlockId,
                        principalTable: "CampaignMapBlocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CampaignMapLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    MapId = table.Column<int>(type: "int", nullable: false),
                    FromBlockId = table.Column<int>(type: "int", nullable: false),
                    ToBlockId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignMapLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignMapLinks_CampaignMapBlocks_FromBlockId",
                        column: x => x.FromBlockId,
                        principalTable: "CampaignMapBlocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CampaignMapLinks_CampaignMapBlocks_ToBlockId",
                        column: x => x.ToBlockId,
                        principalTable: "CampaignMapBlocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CampaignMapLinks_CampaignMaps_MapId",
                        column: x => x.MapId,
                        principalTable: "CampaignMaps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMapBlockFactions_BlockId",
                table: "CampaignMapBlockFactions",
                column: "BlockId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMapBlocks_MapId",
                table: "CampaignMapBlocks",
                column: "MapId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMapLinks_FromBlockId",
                table: "CampaignMapLinks",
                column: "FromBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMapLinks_MapId",
                table: "CampaignMapLinks",
                column: "MapId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMapLinks_ToBlockId",
                table: "CampaignMapLinks",
                column: "ToBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignMaps_EventId",
                table: "CampaignMaps",
                column: "EventId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignMapBlockFactions");

            migrationBuilder.DropTable(
                name: "CampaignMapLinks");

            migrationBuilder.DropTable(
                name: "CampaignMapBlocks");

            migrationBuilder.DropTable(
                name: "CampaignMaps");
        }
    }
}
