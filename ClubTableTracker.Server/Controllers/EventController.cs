using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventController : ControllerBase
{
    private readonly AppDbContext _db;

    public EventController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet("club/{clubId}")]
    public IActionResult GetClubEvents(int clubId)
    {
        var userId = GetUserId();
        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == clubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        var events = _db.ClubEvents
            .Include(e => e.Participants).ThenInclude(p => p.User)
            .Where(e => e.ClubId == clubId)
            .OrderBy(e => e.StartTime)
            .Select(e => new
            {
                e.Id, e.Title, e.StartTime, e.EndTime, e.MaxParticipants, e.EventType, e.GameSystem, e.TableIds,
                e.Description, e.RegulationUrl,
                Participants = e.Participants.Select(p => new { p.User.Id, Name = p.User.DisplayName ?? p.User.Name })
            })
            .ToList();
        return Ok(events);
    }

    [HttpPost("{id}/register")]
    public IActionResult Register(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var ev = _db.ClubEvents
            .Include(e => e.Participants)
            .FirstOrDefault(e => e.Id == id);
        if (ev == null) return NotFound();

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == ev.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        if (ev.Participants.Any(p => p.UserId == userId))
            return BadRequest("Already registered for this event");

        if (ev.Participants.Count >= ev.MaxParticipants)
            return BadRequest("Event is full");

        _db.EventParticipants.Add(new EventParticipant { EventId = id, UserId = userId });
        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}/unregister")]
    public IActionResult Unregister(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.EventParticipants.FirstOrDefault(p => p.EventId == id && p.UserId == userId);
        if (participant == null) return NotFound();

        _db.EventParticipants.Remove(participant);
        _db.SaveChanges();
        return NoContent();
    }
}
