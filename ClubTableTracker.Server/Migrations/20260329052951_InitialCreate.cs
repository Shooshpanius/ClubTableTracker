using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClubTableTracker.Server.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use IF NOT EXISTS so this migration is safe to apply against a database that was
            // previously created by EnsureCreated() (which does not track migrations).
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `Clubs` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Description` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `AccessKey` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `OpenTime` longtext CHARACTER SET utf8mb4 NOT NULL DEFAULT '10:00',
                    `CloseTime` longtext CHARACTER SET utf8mb4 NOT NULL DEFAULT '22:00',
                    CONSTRAINT `PK_Clubs` PRIMARY KEY (`Id`)
                ) CHARACTER SET = utf8mb4;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `Users` (
                    `Id` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `Email` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `GoogleId` longtext CHARACTER SET utf8mb4 NOT NULL,
                    CONSTRAINT `PK_Users` PRIMARY KEY (`Id`)
                ) CHARACTER SET = utf8mb4;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `GameTables` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `ClubId` int NOT NULL,
                    `Number` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Size` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `SupportedGames` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `X` double NOT NULL,
                    `Y` double NOT NULL,
                    `Width` double NOT NULL,
                    `Height` double NOT NULL,
                    CONSTRAINT `PK_GameTables` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_GameTables_Clubs_ClubId` FOREIGN KEY (`ClubId`) REFERENCES `Clubs` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET = utf8mb4;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `Memberships` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `ClubId` int NOT NULL,
                    `Status` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `AppliedAt` datetime(6) NOT NULL,
                    CONSTRAINT `PK_Memberships` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_Memberships_Clubs_ClubId` FOREIGN KEY (`ClubId`) REFERENCES `Clubs` (`Id`) ON DELETE CASCADE,
                    CONSTRAINT `FK_Memberships_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET = utf8mb4;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `Bookings` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `TableId` int NOT NULL,
                    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `StartTime` datetime(6) NOT NULL,
                    `EndTime` datetime(6) NOT NULL,
                    CONSTRAINT `PK_Bookings` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_Bookings_GameTables_TableId` FOREIGN KEY (`TableId`) REFERENCES `GameTables` (`Id`) ON DELETE CASCADE,
                    CONSTRAINT `FK_Bookings_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET = utf8mb4;
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS `BookingParticipants` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `BookingId` int NOT NULL,
                    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    CONSTRAINT `PK_BookingParticipants` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_BookingParticipants_Bookings_BookingId` FOREIGN KEY (`BookingId`) REFERENCES `Bookings` (`Id`) ON DELETE CASCADE,
                    CONSTRAINT `FK_BookingParticipants_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET = utf8mb4;
            ");

            // Create indexes only if they don't exist (ignore duplicate key errors).
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_BookingParticipants_BookingId` ON `BookingParticipants` (`BookingId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_BookingParticipants_UserId` ON `BookingParticipants` (`UserId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_Bookings_TableId` ON `Bookings` (`TableId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_Bookings_UserId` ON `Bookings` (`UserId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_GameTables_ClubId` ON `GameTables` (`ClubId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_Memberships_ClubId` ON `Memberships` (`ClubId`);
            ");
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS `IX_Memberships_UserId` ON `Memberships` (`UserId`);
            ");

            // Add OpenTime / CloseTime to Clubs if they are missing (existing databases created
            // before these columns were added to the model will be missing them).
            migrationBuilder.Sql(@"
                ALTER TABLE `Clubs`
                    ADD COLUMN IF NOT EXISTS `OpenTime` longtext CHARACTER SET utf8mb4 NOT NULL DEFAULT '10:00',
                    ADD COLUMN IF NOT EXISTS `CloseTime` longtext CHARACTER SET utf8mb4 NOT NULL DEFAULT '22:00';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookingParticipants");

            migrationBuilder.DropTable(
                name: "Memberships");

            migrationBuilder.DropTable(
                name: "Bookings");

            migrationBuilder.DropTable(
                name: "GameTables");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Clubs");
        }
    }
}
