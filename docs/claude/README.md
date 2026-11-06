# Documentación de Zooni (para Claude y para el equipo)

Entrada: [`/CLAUDE.md`](../../CLAUDE.md) (reglas y mapa). Estos documentos están
conectados: cada uno dice de qué depende y quién lo usa.

```
                     arquitectura
                    /      |      \
          convenciones  servicios  base-de-datos
           /    |    \       |    \       |
     estilos componentes utilidades seguridad
           \    |    /       |        /
            testing ——— flujos ———— faltaporhacer
```

| Documento | De qué trata |
|---|---|
| [arquitectura.md](arquitectura.md) | Capas, carpetas y cómo viaja un dato de la pantalla a la base |
| [convenciones.md](convenciones.md) | Nombres, imports, errores, comentarios, lint |
| [estilos.md](estilos.md) | Paleta, sombras, tamaño de texto (`src/theme`) |
| [componentes.md](componentes.md) | Catálogo de componentes compartidos y cuándo usar cada uno |
| [utilidades.md](utilidades.md) | Catálogo de `src/utils`, `src/domain`, `src/constants`, `src/hooks` |
| [servicios.md](servicios.md) | Catálogo de `src/services` y cómo escribir uno |
| [base-de-datos.md](base-de-datos.md) | Migraciones, RLS, funciones, cómo cambiar la base |
| [seguridad.md](seguridad.md) | Auth, RLS, secretos, Storage |
| [flujos.md](flujos.md) | Recorridos completos (login, registro, pedido, turno, paseo, match, ZooniVet) |
| [testing.md](testing.md) | Cómo se prueba y cómo agregar tests |
| [faltaporhacer.md](../../faltaporhacer.md) | Deuda técnica conocida, con archivos |
