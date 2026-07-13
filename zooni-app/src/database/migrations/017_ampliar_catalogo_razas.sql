-- =============================================================================
-- Migración 017: Ampliar catálogo de razas al set completo de ZOONI-MVC
-- =============================================================================
-- El catálogo de "razas" (migración 010) traía un subset chico por especie.
-- ZOONI-MVC (github.com/Zooni-Team/ZOONI-MVC) tiene ilustración propia
-- ("_basico.png") para muchas más razas, ya copiadas a
-- zooni-app/wwwroot/img/mascotas/{especie}s/{raza}/. Esta migración agrega
-- esas razas faltantes para que el Registro Paso 2 las ofrezca y cada una
-- muestre su propia imagen (ver src/constants/registroImages.js), en vez de
-- caer en el genérico "otra raza".
--
-- Los nombres están escritos IGUAL (salvo mayúsculas/tildes, que se
-- normalizan al resolver la imagen) a la carpeta correspondiente en
-- wwwroot/img/mascotas/, para que el match sea directo.
-- No se borra ni renombra ninguna raza existente. Idempotente.
-- =============================================================================

INSERT INTO razas (especie, nombre, orden)
SELECT * FROM (VALUES
  -- Perros (carpeta wwwroot/img/mascotas/perros/)
  ('perro', 'Akita Inu', 21),
  ('perro', 'Basset Hound', 22),
  ('perro', 'Bulldog', 23),
  ('perro', 'Caniche', 24),
  ('perro', 'Caniche negro', 25),
  ('perro', 'Galgo', 26),
  ('perro', 'Jack Russell Terrier', 27),
  ('perro', 'Maltés', 28),
  ('perro', 'Pug', 29),
  ('perro', 'San Bernardo', 30),
  ('perro', 'Samoyedo', 31),
  ('perro', 'Weimaraner', 32),

  -- Gatos (carpeta wwwroot/img/mascotas/gatos/)
  ('gato', 'Abisinio', 7),
  ('gato', 'Angora Turco', 8),
  ('gato', 'Azul Ruso', 9),
  ('gato', 'Birmano', 10),
  ('gato', 'Bombay', 11),
  ('gato', 'Bosque de Noruega', 12),
  ('gato', 'British Shorthair', 13),
  ('gato', 'Cornish Rex', 14),
  ('gato', 'Esfinge', 15),
  ('gato', 'Himalayo', 16),
  ('gato', 'Oriental de Pelo Corto', 17),
  ('gato', 'Savannah', 18),
  ('gato', 'Scottish Fold', 19),
  ('gato', 'Siberiano', 20),

  -- Conejos (carpeta wwwroot/img/mascotas/conejos/)
  ('conejo', 'Mini Lop', 5),

  -- Aves (carpeta wwwroot/img/mascotas/aves/)
  ('ave', 'Agapornis', 6),
  ('ave', 'Amazonas', 7),
  ('ave', 'Guacamayo', 8),

  -- Reptiles (carpeta wwwroot/img/mascotas/reptils/)
  ('reptil', 'Boa', 5),
  ('reptil', 'Camaleón', 6),
  ('reptil', 'Camaleón pantera', 7),
  ('reptil', 'Dragón Barbudo', 8),
  ('reptil', 'Gecko Leopardo', 9),
  ('reptil', 'Serpiente del maíz', 10),

  -- Peces (carpeta wwwroot/img/mascotas/pezs/)
  ('pez', 'Cíclido', 5),
  ('pez', 'Koi', 6),

  -- Hamsters (carpeta wwwroot/img/mascotas/hamsters/)
  ('hamster', 'Campbell', 4),
  ('hamster', 'Chino', 5),

  -- Ratones (carpeta wwwroot/img/mascotas/ratons/)
  ('raton', 'Blanco de laboratorio', 2),
  ('raton', 'Fancy', 3),
  ('raton', 'Rata Dumbo', 4),
  ('raton', 'Rata Rex', 5)
) AS v(especie, nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM razas WHERE razas.especie = v.especie AND razas.nombre = v.nombre
);
