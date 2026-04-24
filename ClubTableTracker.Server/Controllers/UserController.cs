using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using ClubTableTracker.Server.Data;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet("me")]
    public IActionResult GetMe()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        return Ok(new { user.Id, user.Email, user.Name, user.DisplayName, user.EnabledGameSystems, user.BookingColors, user.Bio, user.City });
    }

    [HttpPut("display-name")]
    public IActionResult UpdateDisplayName([FromBody] UpdateDisplayNameRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        var trimmed = req.DisplayName?.Trim();
        user.DisplayName = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        _db.SaveChanges();

        return Ok(new { user.Id, user.Email, user.Name, user.DisplayName });
    }

    [HttpPut("game-systems")]
    public IActionResult UpdateGameSystems([FromBody] UpdateGameSystemsRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        var systems = req.EnabledGameSystems ?? new List<string>();
        user.EnabledGameSystems = systems.Count > 0 ? string.Join("|", systems) : null;
        _db.SaveChanges();

        return Ok(new { user.EnabledGameSystems });
    }

    [HttpPut("booking-colors")]
    public IActionResult UpdateBookingColors([FromBody] UpdateBookingColorsRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        user.BookingColors = req.BookingColors;
        _db.SaveChanges();

        return Ok(new { user.BookingColors });
    }
    [HttpPut("bio")]
    public IActionResult UpdateBio([FromBody] UpdateBioRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        var trimmed = req.Bio?.Trim();
        if (trimmed != null && trimmed.Length > 500)
            return BadRequest("Bio must not exceed 500 characters");
        user.Bio = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        _db.SaveChanges();

        return Ok(new { user.Bio });
    }

    [HttpPut("city")]
    public IActionResult UpdateCity([FromBody] UpdateCityRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = _db.Users.Find(userId);
        if (user == null) return NotFound();

        var trimmed = req.City?.Trim();
        if (trimmed != null && trimmed.Length > 50)
            return BadRequest("City must not exceed 50 characters");
        user.City = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        _db.SaveChanges();

        return Ok(new { user.City });
    }
}

public record UpdateDisplayNameRequest(string? DisplayName);
public record UpdateGameSystemsRequest(List<string>? EnabledGameSystems);
public record UpdateBookingColorsRequest(string? BookingColors);
public record UpdateBioRequest(string? Bio);
public record UpdateCityRequest(string? City);
