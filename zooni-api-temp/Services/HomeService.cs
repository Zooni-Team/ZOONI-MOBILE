using Microsoft.Data.SqlClient;
using System.Text.Json;
using ZooniApi.DTOs;

namespace ZooniApi.Services;

public class HomeService
{
    private readonly string _connStr;

    public HomeService(IConfiguration config)
    {
        _connStr = config.GetConnectionString("DefaultConnection")
                   ?? throw new InvalidOperationException("Connection string not configured.");
    }

    // ─── GET /api/v1/home ────────────────────────────────────────────────────

    public async Task<HomeDto?> GetHomeAsync(int userId)
    {
        const string sql = """
            SELECT
                u.Id_User,
                u.Nombre        AS UserNombre,
                u.Apellido      AS UserApellido,
                u.FotoPerfil,
                m.Id_Mascota,
                m.Nombre        AS MascotaNombre,
                m.Especie,
                m.Raza,
                m.Foto          AS MascotaFoto,
                m.FechaNacimiento,
                (SELECT COUNT(*) FROM Notificacion n WHERE n.Id_User = u.Id_User AND n.Leido = 0) AS NotifCount
            FROM [User] u
            LEFT JOIN Mascota m ON m.Id_User = u.Id_User
                AND m.Id_Mascota = (
                    SELECT TOP 1 Id_Mascota FROM Mascota
                    WHERE Id_User = u.Id_User
                    ORDER BY Id_Mascota ASC
                )
            WHERE u.Id_User = @UserId
            """;

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;

        var dto = new HomeDto
        {
            Usuario = new UsuarioDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id_User")),
                Nombre = reader.IsDBNull(reader.GetOrdinal("UserNombre")) ? "" : reader.GetString(reader.GetOrdinal("UserNombre")),
                Apellido = reader.IsDBNull(reader.GetOrdinal("UserApellido")) ? null : reader.GetString(reader.GetOrdinal("UserApellido")),
                FotoPerfil = reader.IsDBNull(reader.GetOrdinal("FotoPerfil")) ? null : reader.GetString(reader.GetOrdinal("FotoPerfil")),
            },
            NotificacionesNoLeidas = reader.GetInt32(reader.GetOrdinal("NotifCount")),
        };

        if (!reader.IsDBNull(reader.GetOrdinal("Id_Mascota")))
        {
            var fechaNac = reader.IsDBNull(reader.GetOrdinal("FechaNacimiento"))
                ? DateTime.Today
                : reader.GetDateTime(reader.GetOrdinal("FechaNacimiento"));

            var totalMonths = (DateTime.Today.Year - fechaNac.Year) * 12 + DateTime.Today.Month - fechaNac.Month;

            dto.MascotaActiva = new MascotaActivaDto
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id_Mascota")),
                Nombre = reader.IsDBNull(reader.GetOrdinal("MascotaNombre")) ? "" : reader.GetString(reader.GetOrdinal("MascotaNombre")),
                Especie = reader.IsDBNull(reader.GetOrdinal("Especie")) ? "" : reader.GetString(reader.GetOrdinal("Especie")),
                Raza = reader.IsDBNull(reader.GetOrdinal("Raza")) ? "" : reader.GetString(reader.GetOrdinal("Raza")),
                FotoUrl = reader.IsDBNull(reader.GetOrdinal("MascotaFoto")) ? null : reader.GetString(reader.GetOrdinal("MascotaFoto")),
                EdadAnios = totalMonths / 12,
                EdadMeses = totalMonths % 12,
            };
        }

        return dto;
    }

    // ─── GET /api/v1/home/config ─────────────────────────────────────────────

    private static readonly List<BotonConfigDto> DefaultConfig = new()
    {
        new() { Seccion = "comunidad",   Orden = 1, Visible = true },
        new() { Seccion = "ficha_medica", Orden = 2, Visible = true },
        new() { Seccion = "mis_mascotas", Orden = 3, Visible = true },
    };

    public async Task<HomeConfigDto> GetConfigAsync(int userId)
    {
        const string sql = "SELECT ConfigJson FROM HomeConfig WHERE Id_User = @UserId";

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);

        var result = await cmd.ExecuteScalarAsync();
        if (result is null or DBNull)
            return new HomeConfigDto { Botones = DefaultConfig };

        var botones = JsonSerializer.Deserialize<List<BotonConfigDto>>(result.ToString()!)
                      ?? DefaultConfig;
        return new HomeConfigDto { Botones = botones };
    }

    // ─── PUT /api/v1/home/config ─────────────────────────────────────────────

    public async Task SaveConfigAsync(int userId, HomeConfigDto config)
    {
        var json = JsonSerializer.Serialize(config.Botones);

        const string sql = """
            IF EXISTS (SELECT 1 FROM HomeConfig WHERE Id_User = @UserId)
                UPDATE HomeConfig SET ConfigJson = @Json, UpdatedAt = SYSUTCDATETIME() WHERE Id_User = @UserId
            ELSE
                INSERT INTO HomeConfig (Id_User, ConfigJson, UpdatedAt) VALUES (@UserId, @Json, SYSUTCDATETIME())
            """;

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);
        cmd.Parameters.AddWithValue("@Json", json);
        await cmd.ExecuteNonQueryAsync();
    }

    // ─── PATCH /api/v1/mascotas/:id/activar ──────────────────────────────────
    // The DB doesn't have an "activa" column yet — we use the first mascota by ID.
    // This method is a no-op placeholder until the column is added.
    public async Task<bool> ActivarMascotaAsync(int userId, int mascotaId)
    {
        // Verify the mascota belongs to the user
        const string sql = "SELECT COUNT(1) FROM Mascota WHERE Id_Mascota = @MascotaId AND Id_User = @UserId";
        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@MascotaId", mascotaId);
        cmd.Parameters.AddWithValue("@UserId", userId);
        var count = (int)(await cmd.ExecuteScalarAsync() ?? 0);
        return count > 0;
    }
}
