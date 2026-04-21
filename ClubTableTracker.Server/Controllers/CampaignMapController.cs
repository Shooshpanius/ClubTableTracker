using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/campaign-map")]
[Authorize]
public class CampaignMapController : ControllerBase
{
    private readonly AppDbContext _db;

    public CampaignMapController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private bool IsMember(string userId, int clubId) =>
        _db.Memberships.Any(m => m.UserId == userId && m.ClubId == clubId && m.Status == "Approved");

    private bool IsAdminOrModerator(string userId, int clubId) =>
        _db.Memberships.Any(m => m.UserId == userId && m.ClubId == clubId && m.Status == "Approved" && m.IsModerator);

    // GET /api/campaign-map/{eventId}
    [HttpGet("{eventId:int}")]
    public IActionResult GetMap(int eventId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsMember(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps
            .Include(m => m.Blocks).ThenInclude(b => b.Factions)
            .Include(m => m.Links)
            .FirstOrDefault(m => m.EventId == eventId);

        if (map == null) return NotFound();

        return Ok(new
        {
            map.Id,
            map.EventId,
            map.MaxInfluence,
            map.Factions,
            Blocks = map.Blocks.Select(b => new
            {
                b.Id,
                b.MapId,
                b.Title,
                b.PosX,
                b.PosY,
                Factions = b.Factions.Select(f => new { f.Id, f.FactionIndex, f.Influence })
            }),
            Links = map.Links.Select(l => new { l.Id, l.MapId, l.FromBlockId, l.ToBlockId })
        });
    }

    // POST /api/campaign-map/{eventId}
    [HttpPost("{eventId:int}")]
    public IActionResult CreateMap(int eventId, [FromBody] MapSettingsDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        if (_db.CampaignMaps.Any(m => m.EventId == eventId))
            return Conflict("Campaign map already exists for this event");

        var map = new CampaignMap
        {
            EventId = eventId,
            MaxInfluence = dto.MaxInfluence,
            Factions = JsonSerializer.Serialize(dto.Factions)
        };
        _db.CampaignMaps.Add(map);
        _db.SaveChanges();

        return Created($"/api/campaign-map/{eventId}", new { map.Id, map.EventId, map.MaxInfluence, map.Factions });
    }

    // PUT /api/campaign-map/{eventId}/settings
    [HttpPut("{eventId:int}/settings")]
    public IActionResult UpdateSettings(int eventId, [FromBody] MapSettingsDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.Include(m => m.Blocks).FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        if (map.Blocks.Count > 0)
            return BadRequest("Cannot change settings when blocks already exist");

        map.MaxInfluence = dto.MaxInfluence;
        map.Factions = JsonSerializer.Serialize(dto.Factions);
        _db.SaveChanges();

        return Ok(new { map.Id, map.EventId, map.MaxInfluence, map.Factions });
    }

    // POST /api/campaign-map/{eventId}/blocks
    [HttpPost("{eventId:int}/blocks")]
    public IActionResult CreateBlock(int eventId, [FromBody] CreateBlockDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        var block = new CampaignMapBlock
        {
            MapId = map.Id,
            Title = dto.Title,
            PosX = dto.PosX,
            PosY = dto.PosY
        };
        _db.CampaignMapBlocks.Add(block);
        _db.SaveChanges();

        return Created($"/api/campaign-map/{eventId}/blocks/{block.Id}",
            new { block.Id, block.MapId, block.Title, block.PosX, block.PosY, Factions = new object[0] });
    }

    // PUT /api/campaign-map/{eventId}/blocks/{blockId}
    [HttpPut("{eventId:int}/blocks/{blockId:int}")]
    public IActionResult UpdateBlock(int eventId, int blockId, [FromBody] UpdateBlockDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        var block = _db.CampaignMapBlocks
            .Include(b => b.Factions)
            .FirstOrDefault(b => b.Id == blockId && b.MapId == map.Id);
        if (block == null) return NotFound();

        block.Title = dto.Title;
        block.PosX = dto.PosX;
        block.PosY = dto.PosY;

        if (dto.Factions != null)
        {
            _db.CampaignMapBlockFactions.RemoveRange(block.Factions);
            foreach (var f in dto.Factions)
            {
                _db.CampaignMapBlockFactions.Add(new CampaignMapBlockFaction
                {
                    BlockId = block.Id,
                    FactionIndex = f.FactionIndex,
                    Influence = f.Influence
                });
            }
        }

        _db.SaveChanges();

        var updatedBlock = _db.CampaignMapBlocks
            .Include(b => b.Factions)
            .First(b => b.Id == blockId);

        return Ok(new
        {
            updatedBlock.Id,
            updatedBlock.MapId,
            updatedBlock.Title,
            updatedBlock.PosX,
            updatedBlock.PosY,
            Factions = updatedBlock.Factions.Select(f => new { f.Id, f.FactionIndex, f.Influence })
        });
    }

    // DELETE /api/campaign-map/{eventId}/blocks/{blockId}
    [HttpDelete("{eventId:int}/blocks/{blockId:int}")]
    public IActionResult DeleteBlock(int eventId, int blockId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        var block = _db.CampaignMapBlocks.FirstOrDefault(b => b.Id == blockId && b.MapId == map.Id);
        if (block == null) return NotFound();

        var links = _db.CampaignMapLinks
            .Where(l => l.FromBlockId == blockId || l.ToBlockId == blockId)
            .ToList();
        _db.CampaignMapLinks.RemoveRange(links);

        _db.CampaignMapBlocks.Remove(block);
        _db.SaveChanges();

        return NoContent();
    }

    // POST /api/campaign-map/{eventId}/links
    [HttpPost("{eventId:int}/links")]
    public IActionResult CreateLink(int eventId, [FromBody] CreateLinkDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        var fromBlock = _db.CampaignMapBlocks.FirstOrDefault(b => b.Id == dto.FromBlockId && b.MapId == map.Id);
        var toBlock = _db.CampaignMapBlocks.FirstOrDefault(b => b.Id == dto.ToBlockId && b.MapId == map.Id);
        if (fromBlock == null || toBlock == null) return BadRequest("Invalid block IDs");

        var link = new CampaignMapLink
        {
            MapId = map.Id,
            FromBlockId = dto.FromBlockId,
            ToBlockId = dto.ToBlockId
        };
        _db.CampaignMapLinks.Add(link);
        _db.SaveChanges();

        return Created($"/api/campaign-map/{eventId}/links/{link.Id}",
            new { link.Id, link.MapId, link.FromBlockId, link.ToBlockId });
    }

    // DELETE /api/campaign-map/{eventId}/links/{linkId}
    [HttpDelete("{eventId:int}/links/{linkId:int}")]
    public IActionResult DeleteLink(int eventId, int linkId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == eventId);
        if (ev == null) return NotFound();

        if (!IsAdminOrModerator(userId, ev.ClubId)) return Forbid();

        var map = _db.CampaignMaps.FirstOrDefault(m => m.EventId == eventId);
        if (map == null) return NotFound();

        var link = _db.CampaignMapLinks.FirstOrDefault(l => l.Id == linkId && l.MapId == map.Id);
        if (link == null) return NotFound();

        _db.CampaignMapLinks.Remove(link);
        _db.SaveChanges();

        return NoContent();
    }
}

public record MapSettingsDto(int MaxInfluence, List<string> Factions);
public record CreateBlockDto(string Title, double PosX, double PosY);
public record UpdateBlockDto(string Title, double PosX, double PosY, List<FactionInfluenceDto>? Factions);
public record FactionInfluenceDto(int FactionIndex, int Influence);
public record CreateLinkDto(int FromBlockId, int ToBlockId);
