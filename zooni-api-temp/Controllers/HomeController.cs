using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZooniApi.DTOs;
using ZooniApi.Services;

namespace ZooniApi.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class HomeController : ControllerBase
{
    private readonly HomeService _homeService;

    public HomeController(HomeService homeService)
    {
        _homeService = homeService;
    }

    // GET /api/v1/home
    [HttpGet("home")]
    public async Task<IActionResult> GetHome()
    {
        var userId = AuthService.GetUserId(User);
        var data = await _homeService.GetHomeAsync(userId);
        if (data is null) return NotFound(new { error = "Usuario no encontrado" });
        return Ok(data);
    }

    // GET /api/v1/home/config
    [HttpGet("home/config")]
    public async Task<IActionResult> GetConfig()
    {
        var userId = AuthService.GetUserId(User);
        var config = await _homeService.GetConfigAsync(userId);
        return Ok(config);
    }

    // PUT /api/v1/home/config
    [HttpPut("home/config")]
    public async Task<IActionResult> SaveConfig([FromBody] HomeConfigDto config)
    {
        var userId = AuthService.GetUserId(User);
        await _homeService.SaveConfigAsync(userId, config);
        return Ok(new { mensaje = "Configuración guardada correctamente" });
    }

    // PATCH /api/v1/mascotas/:id/activar
    [HttpPatch("mascotas/{id:int}/activar")]
    public async Task<IActionResult> ActivarMascota(int id)
    {
        var userId = AuthService.GetUserId(User);
        var ok = await _homeService.ActivarMascotaAsync(userId, id);
        if (!ok) return NotFound(new { error = "Mascota no encontrada" });
        return Ok(new { mensaje = "Mascota activa actualizada", mascota_id = id });
    }
}
