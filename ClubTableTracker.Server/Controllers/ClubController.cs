using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClubController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClubController(AppDbContext db) => _db = db;

    [HttpGet]
    public IActionResult GetClubs()
    {
        var clubs = _db.Clubs.Select(c => new { c.Id, c.Name, c.Description }).ToList();
        return Ok(clubs);
    }

    [HttpGet("{id}/tables")]
    [Authorize]
    public IActionResult GetClubTables(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == id && m.Status == "Approved");
        if (!isMember) return Forbid();
        var tables = _db.GameTables.Where(t => t.ClubId == id).ToList();
        return Ok(tables);
    }

    [HttpPost("{id}/apply")]
    [Authorize]
    public IActionResult ApplyForMembership(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();
        var existing = _db.Memberships.FirstOrDefault(m => m.UserId == userId && m.ClubId == id);
        if (existing != null) return BadRequest("Already applied or member");
        var club = _db.Clubs.Find(id);
        if (club == null) return NotFound();
        var membership = new ClubMembership
        {
            UserId = userId,
            ClubId = id,
            Status = "Pending",
            AppliedAt = DateTime.UtcNow
        };
        _db.Memberships.Add(membership);
        _db.SaveChanges();
        return Ok(new { membership.Id, membership.Status });
    }

    [HttpGet("my-memberships")]
    [Authorize]
    public IActionResult GetMyMemberships()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var memberships = _db.Memberships
            .Include(m => m.Club)
            .Where(m => m.UserId == userId)
            .Select(m => new { m.Id, m.Status, m.AppliedAt, Club = new { m.Club.Id, m.Club.Name, m.Club.Description } })
            .ToList();
        return Ok(memberships);
    }
}
