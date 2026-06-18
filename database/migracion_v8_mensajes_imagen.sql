-- Migración v8: Soporte de imágenes en mensajes
ALTER TABLE mensajes
  ADD COLUMN imagen_url VARCHAR(255) NULL AFTER contenido;
