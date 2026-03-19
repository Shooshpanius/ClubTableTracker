using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("google")]
    public IActionResult GoogleLogin([FromBody] GoogleLoginRequest req)
    {
        // Decode Google JWT ID token without verifying signature (dev mode).
        // In production, verify against Google's public keys.
        JwtSecurityToken googleToken;
        try
        {
            var handler = new JwtSecurityTokenHandler();
            googleToken = handler.ReadJwtToken(req.Credential);
        }
        catch
        {
            return BadRequest("Invalid credential");
        }

        var email = googleToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value ?? "";
        var name = googleToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value ?? "";
        var googleId = googleToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value ?? "";

        if (string.IsNullOrEmpty(email)) return BadRequest("No email in token");

        var user = _db.Users.FirstOrDefault(u => u.GoogleId == googleId);
        if (user == null)
        {
            user = new AppUser
            {
                Id = Guid.NewGuid().ToString(),
                Email = email,
                Name = name,
                GoogleId = googleId
            };
            _db.Users.Add(user);
            _db.SaveChanges();
        }

        var jwt = GenerateJwt(user);
        return Ok(new { token = jwt, user = new { user.Id, user.Email, user.Name } });
    }

    private string GenerateJwt(AppUser user)
    {
        var secret = _config["Jwt:Secret"] ?? "default-secret-key-at-least-32-chars!!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name)
        };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record GoogleLoginRequest(string Credential);
