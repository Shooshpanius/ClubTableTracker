using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MobileAndroid.Models
{
    public class Club
    {
        [JsonPropertyName("id")]   public int Id { get; set; }
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("description")] public string Description { get; set; } = "";
        [JsonPropertyName("openTime")]  public string OpenTime  { get; set; } = "10:00";
        [JsonPropertyName("closeTime")] public string CloseTime { get; set; } = "22:00";
        [JsonPropertyName("logoUrl")]   public string? LogoUrl  { get; set; }
    }

    public class MembershipClub
    {
        [JsonPropertyName("id")]   public int Id { get; set; }
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("description")] public string Description { get; set; } = "";
        [JsonPropertyName("openTime")]  public string OpenTime  { get; set; } = "10:00";
        [JsonPropertyName("closeTime")] public string CloseTime { get; set; } = "22:00";
    }

    public class Membership
    {
        [JsonPropertyName("id")]     public int Id { get; set; }
        [JsonPropertyName("status")] public string Status { get; set; } = "";
        [JsonPropertyName("appliedAt")] public string AppliedAt { get; set; } = "";
        [JsonPropertyName("club")]   public MembershipClub Club { get; set; } = new();
    }

    public class BookingUser
    {
        [JsonPropertyName("id")]   public string Id { get; set; } = "";
        [JsonPropertyName("name")] public string Name { get; set; } = "";
    }

    public class BookingParticipant
    {
        [JsonPropertyName("participantId")] public int? ParticipantId { get; set; }
        [JsonPropertyName("id")]     public string Id { get; set; } = "";
        [JsonPropertyName("name")]   public string Name { get; set; } = "";
        [JsonPropertyName("status")] public string? Status { get; set; }
    }

    public class UpcomingBooking
    {
        [JsonPropertyName("id")]          public int Id { get; set; }
        [JsonPropertyName("tableId")]     public int TableId { get; set; }
        [JsonPropertyName("tableNumber")] public string TableNumber { get; set; } = "";
        [JsonPropertyName("clubName")]    public string ClubName { get; set; } = "";
        [JsonPropertyName("clubId")]      public int ClubId { get; set; }
        [JsonPropertyName("startTime")]   public string StartTime { get; set; } = "";
        [JsonPropertyName("endTime")]     public string EndTime { get; set; } = "";
        [JsonPropertyName("gameSystem")]  public string? GameSystem { get; set; }
        [JsonPropertyName("isDoubles")]   public bool IsDoubles { get; set; }
        [JsonPropertyName("isForOthers")] public bool IsForOthers { get; set; }
        [JsonPropertyName("user")]        public BookingUser User { get; set; } = new();
        [JsonPropertyName("participants")] public List<BookingParticipant> Participants { get; set; } = new();
    }

    public class ActivityLogEntry
    {
        [JsonPropertyName("id")]             public int Id { get; set; }
        [JsonPropertyName("timestamp")]      public string Timestamp { get; set; } = "";
        [JsonPropertyName("action")]         public string Action { get; set; } = "";
        [JsonPropertyName("userName")]       public string UserName { get; set; } = "";
        [JsonPropertyName("tableNumber")]    public string TableNumber { get; set; } = "";
        [JsonPropertyName("clubId")]         public int ClubId { get; set; }
        [JsonPropertyName("bookingStartTime")] public string BookingStartTime { get; set; } = "";
        [JsonPropertyName("bookingEndTime")]   public string BookingEndTime { get; set; } = "";
    }

    public class UserProfile
    {
        [JsonPropertyName("id")]    public string Id { get; set; } = "";
        [JsonPropertyName("email")] public string Email { get; set; } = "";
        [JsonPropertyName("name")]  public string Name { get; set; } = "";
        [JsonPropertyName("displayName")]        public string? DisplayName { get; set; }
        [JsonPropertyName("enabledGameSystems")] public string? EnabledGameSystems { get; set; }
        [JsonPropertyName("bio")]   public string? Bio { get; set; }
    }
}
