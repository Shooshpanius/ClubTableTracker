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
    private const int MaxBookingDaysAhead = 30;

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
                b.GameSystem,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new { p.User.Id, Name = p.User.DisplayName ?? p.User.Name, p.Status })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("my-upcoming")]
    public IActionResult GetMyUpcoming()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var now = DateTime.UtcNow;
        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Table).ThenInclude(t => t.Club)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.EndTime > now &&
                        (b.UserId == userId || b.Participants.Any(p => p.UserId == userId)) &&
                        _db.Memberships.Any(m => m.UserId == userId && m.ClubId == b.Table.ClubId && m.Status == "Approved"))
            .OrderBy(b => b.StartTime)
            .Select(b => new
            {
                b.Id,
                b.TableId,
                TableNumber = b.Table.Number,
                ClubName = b.Table.Club.Name,
                ClubId = b.Table.ClubId,
                b.StartTime,
                b.EndTime,
                b.GameSystem,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new { p.User.Id, Name = p.User.DisplayName ?? p.User.Name, p.Status })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("upcoming-all")]
    public IActionResult GetUpcomingAll()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var approvedClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved")
            .Select(m => m.ClubId)
            .ToList();

        var now = DateTime.UtcNow;
        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Table).ThenInclude(t => t.Club)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.EndTime > now && approvedClubIds.Contains(b.Table.ClubId))
            .OrderBy(b => b.StartTime)
            .Select(b => new
            {
                b.Id,
                b.TableId,
                TableNumber = b.Table.Number,
                ClubName = b.Table.Club.Name,
                ClubId = b.Table.ClubId,
                b.StartTime,
                b.EndTime,
                b.GameSystem,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new { p.User.Id, Name = p.User.DisplayName ?? p.User.Name, p.Status })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("activity-log")]
    public IActionResult GetActivityLog()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var approvedClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved")
            .Select(m => m.ClubId)
            .ToList();

        var since = DateTime.UtcNow.AddMonths(-1);
        var logs = _db.BookingLogs
            .Include(l => l.User)
            .Where(l => l.Timestamp >= since && approvedClubIds.Contains(l.ClubId))
            .OrderByDescending(l => l.Timestamp)
            .Select(l => new
            {
                l.Id,
                l.Timestamp,
                l.Action,
                UserName = l.User.DisplayName ?? l.User.Name,
                l.TableNumber,
                l.ClubId,
                l.BookingStartTime,
                l.BookingEndTime
            })
            .ToList();
        return Ok(logs);
    }

    [HttpPost]
    public IActionResult CreateBooking([FromBody] CreateBookingRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (req.StartTime >= req.EndTime) return BadRequest("End time must be after start time");
        if (req.StartTime < DateTime.UtcNow) return BadRequest("Booking must be in the future");
        if (req.StartTime > DateTime.UtcNow.AddDays(MaxBookingDaysAhead))
            return BadRequest($"Бронирование можно делать не более чем на {MaxBookingDaysAhead} дней вперёд");

        var table = _db.GameTables.Find(req.TableId);
        if (table == null) return NotFound("Table not found");

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == table.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        // Validate booking falls within club working hours
        var club = _db.Clubs.Find(table.ClubId);
        if (club == null) return NotFound("Club not found");

        if (!TimeSpan.TryParse(club.OpenTime, out var openSpan) || !TimeSpan.TryParse(club.CloseTime, out var closeSpan))
            return BadRequest("Некорректная конфигурация рабочего времени клуба");

        int openMinutes = (int)openSpan.TotalMinutes;
        int closeMinutes = (int)closeSpan.TotalMinutes;
        int startMinOfDay = req.StartTime.Hour * 60 + req.StartTime.Minute;
        int endMinOfDay = req.EndTime.Hour * 60 + req.EndTime.Minute;

        if (startMinOfDay < openMinutes || endMinOfDay > closeMinutes)
            return BadRequest($"Время бронирования должно быть в рамках рабочего времени клуба ({club.OpenTime}–{club.CloseTime})");

        // Check for time conflicts (no overlapping bookings allowed; touching boundaries are OK)
        var hasConflict = _db.Bookings
            .Any(b => b.TableId == req.TableId &&
                      b.StartTime < req.EndTime &&
                      b.EndTime > req.StartTime);

        if (hasConflict) return BadRequest("Table is already booked during the requested time period. Please choose a different time slot.");

        // Check event-based restrictions
        var bookingDate = req.StartTime.Date;
        var eventsOnDate = _db.ClubEvents
            .Include(e => e.Participants)
            .Where(e => e.ClubId == table.ClubId && e.Date.Date == bookingDate && e.TableIds != null)
            .ToList()
            .Where(e => e.TableIds!.Split(',').Select(id => id.Trim()).Contains(req.TableId.ToString()))
            .ToList();

        if (eventsOnDate.Count > 0)
        {
            // Table is assigned to an event on this day — only registered participants may book it
            var isRegistered = eventsOnDate.Any(e => e.Participants.Any(p => p.UserId == userId));
            if (!isRegistered)
                return BadRequest("Этот стол зарезервирован для участников события. Запишитесь на событие, чтобы забронировать стол.");
        }
        else if (table.EventsOnly)
        {
            // Table is marked "events only" but no event is scheduled on this day
            return BadRequest("Этот стол доступен только во время событий клуба.");
        }

        var booking = new Booking
        {
            TableId = req.TableId,
            UserId = userId,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            GameSystem = req.GameSystem
        };
        _db.Bookings.Add(booking);
        _db.SaveChanges();

        // Если указан оппонент — создаём приглашение
        if (!string.IsNullOrEmpty(req.InvitedUserId) && req.InvitedUserId != userId)
        {
            var isInviteeMember = _db.Memberships.Any(m => m.UserId == req.InvitedUserId && m.ClubId == table.ClubId && m.Status == "Approved");
            if (isInviteeMember)
            {
                // Проверяем, что у приглашённого включена выбранная игровая система
                bool canInvite = true;
                if (!string.IsNullOrEmpty(req.GameSystem))
                {
                    var invitee = _db.Users.Find(req.InvitedUserId);
                    if (invitee != null)
                    {
                        var inviteeSystems = invitee.EnabledGameSystems?.Split('|', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();
                        canInvite = inviteeSystems.Contains(req.GameSystem);
                    }
                    else
                    {
                        canInvite = false;
                    }
                }

                if (canInvite)
                {
                    _db.BookingParticipants.Add(new BookingParticipant
                    {
                        BookingId = booking.Id,
                        UserId = req.InvitedUserId,
                        Status = "Invited"
                    });
                }
            }
        }

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Booked",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = table.Number,
            ClubId = table.ClubId,
            BookingStartTime = req.StartTime,
            BookingEndTime = req.EndTime
        });
        _db.SaveChanges();

        return Ok(new { booking.Id, booking.TableId, booking.StartTime, booking.EndTime, booking.GameSystem });
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

        if (1 + booking.Participants.Count(p => p.Status == "Accepted") >= 2)
            return BadRequest("Booking is full (max 2 players)");

        var participant = new BookingParticipant { BookingId = id, UserId = userId, Status = "Accepted" };
        _db.BookingParticipants.Add(participant);

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Joined",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        });

        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}/leave")]
    public IActionResult LeaveBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants.FirstOrDefault(p => p.BookingId == id && p.UserId == userId);
        if (participant == null) return NotFound();

        var booking = _db.Bookings.Include(b => b.Table).FirstOrDefault(b => b.Id == id);

        _db.BookingParticipants.Remove(participant);

        if (booking != null)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = DateTime.UtcNow,
                Action = "Left",
                UserId = userId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
        }

        _db.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id && b.UserId == userId);
        if (booking == null) return NotFound();

        var log = new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Cancelled",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        };

        // Передаём владение только принятым участникам (Status == "Accepted")
        var acceptedParticipants = booking.Participants.Where(p => p.Status == "Accepted").OrderBy(p => p.Id).ToList();
        if (acceptedParticipants.Count > 0)
        {
            var newOwner = acceptedParticipants.First();
            booking.UserId = newOwner.UserId;
            _db.BookingParticipants.Remove(newOwner);
            // Оставшихся приглашённых (не принятых) удаляем — владелец покидает игру
            var invitedParticipants = booking.Participants.Where(p => p.Status == "Invited").ToList();
            _db.BookingParticipants.RemoveRange(invitedParticipants);
            _db.BookingLogs.Add(log);
            _db.SaveChanges();
        }
        else
        {
            // Нет принятых участников — удаляем бронирование полностью
            _db.BookingLogs.Add(log);
            _db.Bookings.Remove(booking);
            _db.SaveChanges();
        }

        return NoContent();
    }

    [HttpDelete("{id}/annul")]
    public IActionResult AnnulBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id && b.UserId == userId);
        if (booking == null) return NotFound();

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Cancelled",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        });

        _db.Bookings.Remove(booking); // Cascade удалит всех участников
        _db.SaveChanges();
        return NoContent();
    }

    [HttpPost("{id}/accept-invite")]
    public IActionResult AcceptInvite(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants
            .Include(p => p.Booking).ThenInclude(b => b.Table)
            .FirstOrDefault(p => p.BookingId == id && p.UserId == userId && p.Status == "Invited");
        if (participant == null) return NotFound();

        // Убедимся, что место ещё свободно
        var acceptedCount = _db.BookingParticipants.Count(p => p.BookingId == id && p.Status == "Accepted");
        if (1 + acceptedCount >= 2)
            return BadRequest("Booking is full (max 2 players)");

        participant.Status = "Accepted";

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Joined",
            UserId = userId,
            BookingId = id,
            TableNumber = participant.Booking.Table.Number,
            ClubId = participant.Booking.Table.ClubId,
            BookingStartTime = participant.Booking.StartTime,
            BookingEndTime = participant.Booking.EndTime
        });

        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}/decline-invite")]
    public IActionResult DeclineInvite(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants
            .FirstOrDefault(p => p.BookingId == id && p.UserId == userId && p.Status == "Invited");
        if (participant == null) return NotFound();

        _db.BookingParticipants.Remove(participant);
        _db.SaveChanges();
        return NoContent();
    }
}

public record CreateBookingRequest(int TableId, DateTime StartTime, DateTime EndTime, string? GameSystem = null, string? InvitedUserId = null);
