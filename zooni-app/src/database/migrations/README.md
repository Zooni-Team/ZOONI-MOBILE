# Migraciones de Base de Datos — Zooni

Este directorio contiene los archivos SQL de migración para la base de datos MySQL de Zooni.

## Requisitos

- MySQL 5.7+ o MySQL 8.0+ con soporte para tipos espaciales (`POINT`, `SPATIAL INDEX`)
- Motor de almacenamiento **InnoDB** (requerido para índices espaciales en MySQL 5.7+)
- Usuario con permisos `CREATE TABLE`, `CREATE INDEX` sobre la base de datos destino

## Cómo ejecutar las migraciones

### Opción 1 — Cliente MySQL en línea de comandos

```bash
mysql -u <usuario> -p <nombre_base_de_datos> < 001_comunidad.sql
```

Ejemplo:

```bash
mysql -u root -p zooni_db < 001_comunidad.sql
```

### Opción 2 — Desde MySQL Workbench

1. Abrir MySQL Workbench y conectarse al servidor.
2. Ir a **File → Open SQL Script** y seleccionar el archivo `.sql`.
3. Ejecutar con el botón ⚡ o `Ctrl+Shift+Enter`.

### Opción 3 — Desde DBeaver u otro cliente SQL

1. Abrir una nueva pestaña de consulta conectada a la base de datos destino.
2. Pegar o importar el contenido del archivo `.sql`.
3. Ejecutar el script completo.

## Orden de ejecución

Ejecutar los archivos en orden numérico ascendente:

| Archivo              | Descripción                                      |
|----------------------|--------------------------------------------------|
| `001_comunidad.sql`  | Tablas del módulo Comunidad con índices espaciales |

## Tablas creadas por `001_comunidad.sql`

| Tabla                  | Descripción                                                  |
|------------------------|--------------------------------------------------------------|
| `carteles`             | Publicaciones geolocalizadas (mascotas perdidas, avisos, etc.) |
| `servicios`            | Veterinarias, paseadores, pet shops y peluquerías caninas    |
| `amistades`            | Relaciones de amistad entre usuarios                         |
| `ubicaciones_usuarios` | Posición geográfica actual de cada usuario                   |

## Notas sobre índices espaciales

Las tablas `carteles`, `servicios` y `ubicaciones_usuarios` incluyen un `SPATIAL INDEX` sobre la columna `ubicacion` (tipo `POINT`). Esto permite ejecutar queries de bounding box con `MBRContains` de forma eficiente, garantizando tiempos de respuesta menores a 500ms para conjuntos de hasta 10.000 registros (ver Requisito 15.5).

En MySQL, las columnas con `SPATIAL INDEX` deben ser `NOT NULL`.

## Rollback

Para revertir la migración `001_comunidad.sql`:

```sql
DROP TABLE IF EXISTS ubicaciones_usuarios;
DROP TABLE IF EXISTS amistades;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS carteles;
```

> ⚠️ Esta operación elimina todos los datos. Realizar un backup antes de ejecutar.
