namespace ClubTableTracker.Server.Models;

public class BookingParticipant
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    /// <summary>"Invited" — ожидает ответа, "Accepted" — принял приглашение или присоединился самостоятельно</summary>
    public string Status { get; set; } = "Accepted";
}
