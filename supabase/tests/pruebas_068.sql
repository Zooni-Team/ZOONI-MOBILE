DO $$
DECLARE
  sufijo TEXT := substr(md5(random()::TEXT), 1, 8);
  yo_auth UUID := gen_random_uuid();
  base TEXT := 'https://x.supabase.co/storage/v1/object/public/public-images/' || yo_auth || '/';
  yo INTEGER; mascota INTEGER; consulta INTEGER; consulta_vieja INTEGER; r JSONB; fallo BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (yo_auth, 'arch068.' || sufijo || '@prueba.test');
  PERFORM pg_temp.como(yo_auth);
  r := registrar_social_con_mascota(
    jsonb_build_object('nombre', 'Lola', 'apellido', 'Archivos'),
    jsonb_build_object('nombre', 'Rayo', 'especie', 'perro', 'sexo', 'macho', 'raza', 'Mestizo', 'peso', 12));
  yo := (r->>'id')::INTEGER;
  SELECT "Id_Mascota" INTO mascota FROM "Mascota" WHERE "Id_User" = yo;

  UPDATE "Mascota" SET "Foto" = base || 'mascotas/principal.jpg' WHERE "Id_Mascota" = mascota;
  INSERT INTO mascota_fotos (id_mascota, url) VALUES
    (mascota, base || 'mascotas/principal.jpg'),
    (mascota, base || 'mascotas/otra.jpg'),
    (mascota, 'https://lh3.googleusercontent.com/a/externa.jpg');
  INSERT INTO consultas_veterinarias (mascota_id, fecha, motivo, imagen_path)
  VALUES (mascota, current_date, 'Control', yo_auth || '/consultas/estudio.jpg') RETURNING id INTO consulta;
  INSERT INTO consultas_veterinarias (mascota_id, fecha, motivo, imagen_url)
  VALUES (mascota, current_date, 'Receta vieja', base || 'consultas/receta.jpg') RETURNING id INTO consulta_vieja;

  fallo := FALSE;
  BEGIN PERFORM 1 FROM archivos_por_borrar; EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE; END;
  ASSERT fallo, 'la cola de archivos no se lee desde la app';
  fallo := FALSE;
  BEGIN PERFORM privatizar_imagen_consulta(consulta_vieja, 'x'); EXCEPTION WHEN insufficient_privilege THEN fallo := TRUE; END;
  ASSERT fallo, 'un usuario no muda imágenes de consultas';

  DELETE FROM mascota_fotos WHERE id_mascota = mascota;
  PERFORM pg_temp.salir();

  ASSERT EXISTS (SELECT 1 FROM archivos_por_borrar WHERE ruta = yo_auth || '/mascotas/otra.jpg'),
    'borrar una foto anota su archivo';
  ASSERT NOT EXISTS (SELECT 1 FROM archivos_por_borrar WHERE ruta LIKE '%externa.jpg'),
    'una URL externa no se anota';
  ASSERT NOT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE ruta = yo_auth || '/mascotas/principal.jpg'),
    'la foto principal sigue en uso: no se ofrece para borrar';
  ASSERT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE ruta = yo_auth || '/mascotas/otra.jpg'),
    'la que ya nadie usa sí se ofrece';

  ASSERT EXISTS (SELECT 1 FROM consultas_a_privatizar() c
                 WHERE c.id = consulta_vieja AND c.carpeta = yo_auth || '/consultas'),
    'la consulta vieja aparece para mudar, con la carpeta del dueño';
  ASSERT NOT privatizar_imagen_consulta(consulta_vieja, gen_random_uuid() || '/consultas/robada.jpg'),
    'no se puede apuntar a la carpeta de otra persona';
  ASSERT privatizar_imagen_consulta(consulta_vieja, yo_auth || '/consultas/receta-privada.jpg'),
    'la mudanza a la carpeta del dueño funciona';
  ASSERT NOT privatizar_imagen_consulta(consulta_vieja, yo_auth || '/consultas/otra-vez.jpg'),
    'una consulta ya mudada no se vuelve a mudar';
  ASSERT (SELECT imagen_url IS NULL AND imagen_path = yo_auth || '/consultas/receta-privada.jpg'
          FROM consultas_veterinarias WHERE id = consulta_vieja), 'la consulta quedó apuntando a la copia privada';
  ASSERT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE bucket = 'public-images' AND ruta = yo_auth || '/consultas/receta.jpg'),
    'la imagen pública vieja queda para borrar';

  DELETE FROM "Mascota" WHERE "Id_Mascota" = mascota;
  ASSERT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE ruta = yo_auth || '/mascotas/principal.jpg'),
    'al borrar la mascota su foto principal queda para borrar';
  ASSERT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE bucket = 'consultas-privadas' AND ruta = yo_auth || '/consultas/estudio.jpg'),
    'y las imágenes privadas de sus consultas también';
  ASSERT EXISTS (SELECT 1 FROM archivos_para_borrar() WHERE bucket = 'consultas-privadas' AND ruta = yo_auth || '/consultas/receta-privada.jpg'),
    'incluida la que se mudó';

  RAISE NOTICE 'pruebas_068: OK';
END $$;
