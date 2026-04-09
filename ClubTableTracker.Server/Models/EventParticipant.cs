namespace ClubTableTracker.Server.Models;

public class EventParticipant
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public ClubEvent Event { get; set; } = null!;
    public string UserId { get; set; } = "";
    public AppUser User { get; set; } = null!;
    public string? Roster { get; set; }
}
