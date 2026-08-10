-- ============================================================
-- cobrApp - Migracion v20: Notificaciones Push (Expo)
-- Fecha: Agosto 2026
-- Objetivo:
--   - Guardar los tokens de notificaciones push de cada
--     dispositivo para poder enviar alertas de cobranzas
--     vencidas o proximas a vencer.
--   - Un usuario puede tener varios dispositivos (telefono,
--     tablet, etc.), por eso se usa una tabla separada.
-- ============================================================

START TRANSACTION;

CREATE TABLE IF NOT EXISTS push_tokens (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  usuario_id    BIGINT       NOT NULL COMMENT 'FK usuarios.id',
  token         VARCHAR(255) NOT NULL COMMENT 'Expo Push Token',
  plataforma    VARCHAR(20)  NULL COMMENT 'android | ios',
  ultimo_uso    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_token (token),
  KEY idx_push_usuario (usuario_id),
  CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) COMMENT='Tokens de notificaciones push por dispositivo';

COMMIT;
