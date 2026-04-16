using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class ClubEvent
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    [MaxLength(200)]  public string Title       { get; set; } = "";
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MaxParticipants { get; set; }
    public string EventType { get; set; } = "Tournament";
    [MaxLength(100)]  public string? GameSystem  { get; set; }
    [MaxLength(500)]  public string? TableIds    { get; set; }
    [MaxLength(500)]  public string? Description { get; set; }
    [MaxLength(500)]  public string? RegulationUrl  { get; set; }
    [MaxLength(500)]  public string? RegulationUrl2 { get; set; }
    [MaxLength(500)]  public string? MissionMapUrl  { get; set; }
    public string? GameMasterUserId { get; set; }
    public List<EventParticipant> Participants { get; set; } = new();
}
