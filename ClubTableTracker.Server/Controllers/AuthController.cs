using Google.Apis.Auth;
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
    private readonly ILogger<AuthController> _logger;

    public AuthController(AppDbContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest req)
    {
        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrEmpty(clientId))
        {
            _logger.LogWarning("Google:ClientId is not configured. Audience validation will be skipped.");
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var validationSettings = string.IsNullOrEmpty(clientId)
                ? null
                : new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } };
            payload = await GoogleJsonWebSignature.ValidateAsync(req.Credential, validationSettings);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Google ID token validation failed.");
            return BadRequest("Invalid credential");
        }

        var email = payload.Email ?? "";
        var name = payload.Name ?? "";
        var googleId = payload.Subject ?? "";

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
