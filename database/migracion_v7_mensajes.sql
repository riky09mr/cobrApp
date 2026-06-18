-- Migración v7: Sistema de mensajería supervisor ↔ cobrador
CREATE TABLE IF NOT EXISTS mensajes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id  INT  NOT NULL,
  emisor_id   INT  NOT NULL,
  receptor_id INT  NOT NULL,
  contenido   TEXT NOT NULL,
  leido       TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id)  REFERENCES empresas(id)  ON DELETE CASCADE,
  FOREIGN KEY (emisor_id)   REFERENCES usuarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (receptor_id) REFERENCES usuarios(id)  ON DELETE CASCADE,
  INDEX idx_receptor_leido (receptor_id, leido),
  INDEX idx_conv (emisor_id, receptor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
