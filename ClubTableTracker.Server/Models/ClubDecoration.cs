namespace ClubTableTracker.Server.Models;

public class ClubDecoration
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    public string Type { get; set; } = "wall"; // wall / window / door
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; } = 100;
    public double Height { get; set; } = 20;
}
