using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZooniApi.Services;

namespace ZooniApi.Controllers;

[ApiController]
[Route("api/v1/notificaciones")]
[Authorize]
public class NotificacionesController : ControllerBase
{
    private readonly NotificacionService _service;

    public NotificacionesController(NotificacionService service)
    {
        _service = service;
    }

    // GET /api/v1/notificaciones?page=1&limit=20&leidas=false
    [HttpGet]
    public async Task<IActionResult> GetNotificaciones(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? leidas = null)
    {
        var userId = AuthService.GetUserId(User);
        var soloNoLeidas = leidas == "false";
        var result = await _service.GetNotificacionesAsync(userId, page, limit, soloNoLeidas);
        return Ok(result);
    }

    // PATCH /api/v1/notificaciones/:id/leer
    [HttpPatch("{id:int}/leer")]
    public async Task<IActionResult> MarcarLeida(int id)
    {
        var userId = AuthService.GetUserId(User);
        var ok = await _service.MarcarLeidaAsync(userId, id);
        if (!ok) return NotFound(new { error = "Notificación no encontrada" });
        return Ok(new { mensaje = "Notificación marcada como leída" });
    }

    // PATCH /api/v1/notificaciones/leer-todas
    [HttpPatch("leer-todas")]
    public async Task<IActionResult> MarcarTodasLeidas()
    {
        var userId = AuthService.GetUserId(User);
        var count = await _service.MarcarTodasLeidasAsync(userId);
        return Ok(new { mensaje = "Todas las notificaciones marcadas como leídas", actualizadas = count });
    }
}
