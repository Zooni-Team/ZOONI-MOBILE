using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ZooniApi.Services;

public class AuthService
{
    private readonly string _connStr;
    private readonly IConfiguration _config;

    public AuthService(IConfiguration config)
    {
        _config = config;
        _connStr = config.GetConnectionString("DefaultConnection")!;
    }

    /// <summary>
    /// Validates credentials and returns a JWT if valid, null otherwise.
    /// Passwords are stored as bcrypt hashes — for now we do a plain comparison
    /// as a placeholder. Replace with BCrypt.Net when adding proper auth.
    /// </summary>
    public async Task<string?> LoginAsync(string email, string password)
    {
        const string sql = """
            SELECT Id_User, Nombre, Contrasena
            FROM [User]
            WHERE Mail = @Email AND Estado = 1
            """;

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Email", email);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;

        var userId = reader.GetInt32(0);
        var nombre = reader.GetString(1);
        var storedHash = reader.GetString(2);

        // TODO: replace with BCrypt.Net.BCrypt.Verify(password, storedHash)
        if (storedHash != password) return null;

        return GenerateToken(userId, nombre);
    }

    public string GenerateToken(int userId, string nombre)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Name, nombre),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(double.Parse(_config["Jwt:ExpiresInHours"]!)),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static int GetUserId(ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? throw new UnauthorizedAccessException();
        return int.Parse(sub);
    }
}
