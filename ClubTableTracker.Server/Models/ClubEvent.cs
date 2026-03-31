namespace ClubTableTracker.Server.Models;

public class ClubEvent
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    public string Title { get; set; } = "";
    public DateTime Date { get; set; }
    public int MaxParticipants { get; set; }
    public string EventType { get; set; } = "Tournament";
    public string? GameSystem { get; set; }
    public string? TableIds { get; set; }
    public List<EventParticipant> Participants { get; set; } = new();
}
