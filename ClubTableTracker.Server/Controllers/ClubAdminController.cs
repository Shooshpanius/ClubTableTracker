using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClubAdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClubAdminController(AppDbContext db) => _db = db;

    private Club? GetAuthorizedClub()
    {
        if (!Request.Headers.TryGetValue("X-Club-Key", out var key)) return null;
        return _db.Clubs.FirstOrDefault(c => c.AccessKey == key.ToString());
    }

    [HttpGet("me")]
    public IActionResult GetMe()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        return Ok(new { club.Id, club.Name, club.Description });
    }

    [HttpGet("tables")]
    public IActionResult GetTables()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var tables = _db.GameTables
            .Where(t => t.ClubId == club.Id)
            .Select(t => new { t.Id, t.ClubId, t.Number, t.Size, t.SupportedGames, t.X, t.Y, t.Width, t.Height })
            .ToList();
        return Ok(tables);
    }

    [HttpPost("tables")]
    public IActionResult CreateTable([FromBody] TableRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = new GameTable
        {
            ClubId = club.Id,
            Number = req.Number,
            Size = req.Size,
            SupportedGames = req.SupportedGames,
            X = req.X,
            Y = req.Y,
            Width = req.Width,
            Height = req.Height
        };
        _db.GameTables.Add(table);
        _db.SaveChanges();
        return Ok(new { table.Id, table.ClubId, table.Number, table.Size, table.SupportedGames, table.X, table.Y, table.Width, table.Height });
    }

    [HttpPut("tables/{id}")]
    public IActionResult UpdateTable(int id, [FromBody] TableRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = _db.GameTables.FirstOrDefault(t => t.Id == id && t.ClubId == club.Id);
        if (table == null) return NotFound();
        table.Number = req.Number;
        table.Size = req.Size;
        table.SupportedGames = req.SupportedGames;
        table.X = req.X;
        table.Y = req.Y;
        table.Width = req.Width;
        table.Height = req.Height;
        _db.SaveChanges();
        return Ok(new { table.Id, table.ClubId, table.Number, table.Size, table.SupportedGames, table.X, table.Y, table.Width, table.Height });
    }

    [HttpDelete("tables/{id}")]
    public IActionResult DeleteTable(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = _db.GameTables.FirstOrDefault(t => t.Id == id && t.ClubId == club.Id);
        if (table == null) return NotFound();
        _db.GameTables.Remove(table);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpGet("memberships")]
    public IActionResult GetMemberships()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var memberships = _db.Memberships
            .Include(m => m.User)
            .Where(m => m.ClubId == club.Id)
            .Select(m => new { m.Id, m.Status, m.AppliedAt, User = new { m.User.Id, m.User.Name, m.User.Email } })
            .ToList();
        return Ok(memberships);
    }

    [HttpPost("memberships/{id}/approve")]
    public IActionResult ApproveMembership(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id);
        if (membership == null) return NotFound();
        membership.Status = "Approved";
        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("memberships/{id}/reject")]
    public IActionResult RejectMembership(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id);
        if (membership == null) return NotFound();
        membership.Status = "Rejected";
        _db.SaveChanges();
        return Ok();
    }
}

public record TableRequest(string Number, string Size, string SupportedGames, double X, double Y, double Width, double Height);
