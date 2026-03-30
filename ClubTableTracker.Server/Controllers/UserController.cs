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

        return Ok(new { user.Id, user.Email, user.Name, user.DisplayName });
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
}

public record UpdateDisplayNameRequest(string? DisplayName);
