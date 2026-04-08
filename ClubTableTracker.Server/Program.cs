using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Default")
        ?? "Server=localhost;Database=clubtracker;User=root;Password=your-password;";
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "default-secret-key-at-least-32-chars!!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("https://localhost:5173", "http://localhost:5173", "https://go40k.ru")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();

        // Seed the virtual "ЗАБРОНИРОВАНО" user used as a placeholder for reserved slots
        if (!db.Users.Any(u => u.Id == BookingConstants.ReservedUserId))
        {
            db.Users.Add(new ClubTableTracker.Server.Models.AppUser
            {
                Id = BookingConstants.ReservedUserId,
                Email = "",
                Name = "ЗАБРОНИРОВАНО",
                GoogleId = ""
            });
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database migration failed. The application will start, but database-dependent features may not work.");
    }
}

app.Use(async (context, next) =>
{
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
    await next();
});

app.UseDefaultFiles();
app.MapStaticAssets();

// Serve uploaded club images (logos, gallery photos)
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
