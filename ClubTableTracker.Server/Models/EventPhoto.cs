namespace ClubTableTracker.Server.Models;

public class EventPhoto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public ClubEvent Event { get; set; } = null!;
    public string Url { get; set; } = "";
    public int OrderIndex { get; set; }
}
