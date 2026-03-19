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
public class BookingController : ControllerBase
{
    private readonly AppDbContext _db;

    public BookingController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet("club/{clubId}")]
    public IActionResult GetBookings(int clubId)
    {
        var userId = GetUserId();
        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == clubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.Table.ClubId == clubId)
            .Select(b => new
            {
                b.Id,
                b.TableId,
                b.StartTime,
                b.EndTime,
                User = new { b.User.Id, b.User.Name },
                Participants = b.Participants.Select(p => new { p.User.Id, p.User.Name })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpPost]
    public IActionResult CreateBooking([FromBody] CreateBookingRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (req.StartTime >= req.EndTime) return BadRequest("End time must be after start time");
        if (req.StartTime < DateTime.UtcNow) return BadRequest("Booking must be in the future");

        var table = _db.GameTables.Find(req.TableId);
        if (table == null) return NotFound("Table not found");

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == table.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        // Check for conflicts (max 2 players simultaneously)
        var overlapping = _db.Bookings
            .Include(b => b.Participants)
            .Where(b => b.TableId == req.TableId &&
                        b.StartTime < req.EndTime &&
                        b.EndTime > req.StartTime)
            .ToList();

        var totalPlayers = overlapping.Sum(b => 1 + b.Participants.Count);
        if (totalPlayers >= 2) return BadRequest("Table is full for this time slot (max 2 players)");

        var booking = new Booking
        {
            TableId = req.TableId,
            UserId = userId,
            StartTime = req.StartTime,
            EndTime = req.EndTime
        };
        _db.Bookings.Add(booking);
        _db.SaveChanges();
        return Ok(new { booking.Id, booking.TableId, booking.StartTime, booking.EndTime });
    }

    [HttpPost("{id}/join")]
    public IActionResult JoinBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == booking.Table.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        if (booking.UserId == userId || booking.Participants.Any(p => p.UserId == userId))
            return BadRequest("Already in this booking");

        if (1 + booking.Participants.Count >= 2)
            return BadRequest("Booking is full (max 2 players)");

        var participant = new BookingParticipant { BookingId = id, UserId = userId };
        _db.BookingParticipants.Add(participant);
        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteBooking(int id)
    {
        var userId = GetUserId();
        var booking = _db.Bookings.FirstOrDefault(b => b.Id == id && b.UserId == userId);
        if (booking == null) return NotFound();
        _db.Bookings.Remove(booking);
        _db.SaveChanges();
        return NoContent();
    }
}

public record CreateBookingRequest(int TableId, DateTime StartTime, DateTime EndTime);
