using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class CampaignMap
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public ClubEvent Event { get; set; } = null!;
    public int MaxInfluence { get; set; }
    public string Factions { get; set; } = "[]";
    public List<CampaignMapBlock> Blocks { get; set; } = new();
    public List<CampaignMapLink> Links { get; set; } = new();
}

public class CampaignMapBlock
{
    public int Id { get; set; }
    public int MapId { get; set; }
    public CampaignMap Map { get; set; } = null!;
    [MaxLength(200)] public string Title { get; set; } = "";
    public double PosX { get; set; }
    public double PosY { get; set; }
    public List<CampaignMapBlockFaction> Factions { get; set; } = new();
}

public class CampaignMapBlockFaction
{
    public int Id { get; set; }
    public int BlockId { get; set; }
    public CampaignMapBlock Block { get; set; } = null!;
    public int FactionIndex { get; set; }
    public int Influence { get; set; }
}

public class CampaignMapLink
{
    public int Id { get; set; }
    public int MapId { get; set; }
    public CampaignMap Map { get; set; } = null!;
    public int FromBlockId { get; set; }
    public CampaignMapBlock FromBlock { get; set; } = null!;
    public int ToBlockId { get; set; }
    public CampaignMapBlock ToBlock { get; set; } = null!;
}
