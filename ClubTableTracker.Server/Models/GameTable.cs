using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class GameTable
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    [MaxLength(50)]   public string Number        { get; set; } = string.Empty;
    [MaxLength(20)]   public string Size          { get; set; } = "Medium"; // Small/Medium/Large
    [MaxLength(500)]  public string SupportedGames { get; set; } = string.Empty; // comma-separated
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; } = 100;
    public double Height { get; set; } = 60;
    public bool EventsOnly { get; set; } = false;
    public List<Booking> Bookings { get; set; } = new();
}
