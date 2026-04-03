namespace ClubTableTracker.Server.Models;

/// <summary>Well-known identifiers shared across booking logic.</summary>
public static class BookingConstants
{
    /// <summary>Virtual user ID used to mark a booking slot as reserved without a specific opponent.</summary>
    public const string ReservedUserId = "__RESERVED__";
}
