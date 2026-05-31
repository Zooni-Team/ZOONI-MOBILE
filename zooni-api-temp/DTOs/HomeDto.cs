namespace ZooniApi.DTOs;

public class HomeDto
{
    public UsuarioDto Usuario { get; set; } = null!;
    public MascotaActivaDto? MascotaActiva { get; set; }
    public int NotificacionesNoLeidas { get; set; }
}

public class UsuarioDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Apellido { get; set; }
    public string? FotoPerfil { get; set; }
}

public class MascotaActivaDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Especie { get; set; } = string.Empty;
    public string Raza { get; set; } = string.Empty;
    public string? FotoUrl { get; set; }
    public int EdadAnios { get; set; }
    public int EdadMeses { get; set; }
}

public class HomeConfigDto
{
    public List<BotonConfigDto> Botones { get; set; } = new();
}

public class BotonConfigDto
{
    public string Seccion { get; set; } = string.Empty;
    public int Orden { get; set; }
    public bool Visible { get; set; }
}

public class NotificacionDto
{
    public int Id { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string Cuerpo { get; set; } = string.Empty;
    public bool Leida { get; set; }
    public string? FotoUrl { get; set; }
    public string? Redirigea { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificacionesResponse
{
    public List<NotificacionDto> Notificaciones { get; set; } = new();
    public int TotalNoLeidas { get; set; }
}
