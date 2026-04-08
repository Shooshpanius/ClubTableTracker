namespace ClubTableTracker.Server.Models;

public class ClubPhoto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    public string Url { get; set; } = "";
    public int OrderIndex { get; set; }
}
