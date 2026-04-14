using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AdminController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    private bool IsAuthorized() =>
        Request.Headers.TryGetValue("X-Master-Key", out var key) &&
        key == _config["MasterKey"];

    [HttpGet("clubs")]
    public IActionResult GetClubs()
    {
        if (!IsAuthorized()) return Unauthorized();
        var clubs = _db.Clubs.Select(c => new { c.Id, c.Name, c.Description, c.AccessKey }).ToList();
        return Ok(clubs);
    }

    [HttpPost("clubs")]
    public IActionResult CreateClub([FromBody] CreateClubRequest req)
    {
        if (!IsAuthorized()) return Unauthorized();
        var club = new Club
        {
            Name = req.Name,
            Description = req.Description,
            AccessKey = Guid.NewGuid().ToString("N")[..16]
        };
        _db.Clubs.Add(club);
        _db.SaveChanges();
        return Ok(new { club.Id, club.Name, club.Description, club.AccessKey });
    }

    [HttpPost("clubs/{id}/regenerate-key")]
    public IActionResult RegenerateKey(int id)
    {
        if (!IsAuthorized()) return Unauthorized();
        var club = _db.Clubs.Find(id);
        if (club == null) return NotFound();
        club.AccessKey = Guid.NewGuid().ToString("N")[..16];
        _db.SaveChanges();
        return Ok(new { club.AccessKey });
    }
}

public record CreateClubRequest(string Name, string Description);
