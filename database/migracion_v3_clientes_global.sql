-- ============================================================
-- cobrApp - Migración v3.0
-- Fecha: Mayo 2026
-- Descripción: Reestructura de clientes
--
--   ANTES:  clientes tiene empresa_id (un cliente = una empresa)
--   AHORA:  clientes es global (CI único), la relación con cada
--           empresa vive en la tabla pivot clientes_empresas.
--
-- Esto permite que un mismo cliente (mismo CI) sea cliente de
-- varias empresas sin duplicar sus datos, y que cada empresa
-- solo vea sus propios clientes.
-- ============================================================
-- IMPORTANTE: Ejecutar en este orden exacto.
-- Hacer un backup previo de la base de datos antes de correr.
-- ============================================================


-- ============================================================
-- PASO 0: Backup de seguridad de la tabla actual
-- ============================================================

CREATE TABLE clientes_v2_backup AS SELECT * FROM clientes;

-- Verificar que el backup quedó completo antes de continuar:
-- SELECT COUNT(*) FROM clientes_v2_backup;
-- SELECT COUNT(*) FROM clientes;
-- (deben ser iguales)


-- ============================================================
-- PASO 1: Eliminar FKs y referencias que apuntan a clientes
--         (ajustar nombres si tu schema usa otros nombres)
-- ============================================================

-- FK de creditos -> clientes (comentadas: en este schema no existen como constraints nombrados)
-- Si en tu schema sí existen, descomenta y usa el nombre exacto del constraint.
-- ALTER TABLE creditos      DROP FOREIGN KEY fk_creditos_cliente;
-- ALTER TABLE asignaciones  DROP FOREIGN KEY fk_asignaciones_cliente;


-- ============================================================
-- PASO 2: Renombrar tabla actual para liberar el nombre
-- ============================================================

RENAME TABLE clientes TO clientes_empresa_old;


-- ============================================================
-- PASO 3: Nueva tabla clientes — datos globales, CI único
-- ============================================================

CREATE TABLE clientes (
  id         INT          NOT NULL AUTO_INCREMENT,
  cedula     VARCHAR(20)  NOT NULL
               COMMENT 'CI o RUC — identificador único global del cliente',
  nombre     VARCHAR(100) NOT NULL,
  apellido   VARCHAR(100) NULL,
  telefono   VARCHAR(20)  NULL,
  email      VARCHAR(150) NULL,
  created_at DATETIME     DEFAULT NOW(),
  updated_at DATETIME     DEFAULT NOW() ON UPDATE NOW(),

  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_cedula (cedula)
) COMMENT 'Clientes globales — un registro por persona/empresa identificada por CI/RUC';


-- ============================================================
-- PASO 4: Nueva tabla pivot clientes_empresas
--         Datos específicos de la relación cliente ↔ empresa:
--         ubicación, zona, estado dentro de esa empresa.
-- ============================================================

CREATE TABLE clientes_empresas (
  id          INT           NOT NULL AUTO_INCREMENT,
  cliente_id  INT           NOT NULL COMMENT 'Mismo tipo que clientes.id (INT)',
  empresa_id  BIGINT        NOT NULL COMMENT 'Mismo tipo que empresas.id (BIGINT)',
  direccion   VARCHAR(255)  NULL,
  latitud     DECIMAL(10,8) NULL,
  longitud    DECIMAL(11,8) NULL,
  zona_id     BIGINT        NULL     COMMENT 'Mismo tipo que zonas.id (BIGINT)',
  estado      TINYINT(1)    DEFAULT 1,
  created_at  DATETIME      DEFAULT NOW(),

  PRIMARY KEY (id),
  UNIQUE KEY uq_cliente_empresa (cliente_id, empresa_id),

  CONSTRAINT fk_ce_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ce_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ce_zona    FOREIGN KEY (zona_id)    REFERENCES zonas(id)     ON DELETE SET NULL

) COMMENT 'Relación cliente↔empresa: cada empresa ve solo sus clientes con sus datos geográficos';


-- ============================================================
-- PASO 5: Migrar clientes únicos desde el backup
--         Para cada CI único, se toma el registro más antiguo
--         (menor id). Clientes sin CI obtienen placeholder.
-- ============================================================

INSERT INTO clientes (cedula, nombre, apellido, telefono, email, created_at)
SELECT
  tmp.cedula_key,
  v.nombre,
  v.apellido,
  v.telefono,
  v.email,
  v.created_at
FROM (
  -- Por cada CI único, tomar el id más antiguo
  SELECT
    CASE
      WHEN TRIM(COALESCE(cedula, '')) = '' THEN CONCAT('sin-ci-', id)
      ELSE TRIM(cedula)
    END AS cedula_key,
    MIN(id) AS min_id
  FROM clientes_empresa_old
  GROUP BY cedula_key
) tmp
INNER JOIN clientes_empresa_old v ON v.id = tmp.min_id;


-- ============================================================
-- PASO 6: Migrar relaciones cliente↔empresa
--         Un mismo cliente puede aparecer en múltiples empresas
--         en el backup; aquí se genera una fila por combinación
--         (cliente_id, empresa_id).
-- ============================================================

INSERT INTO clientes_empresas (cliente_id, empresa_id, direccion, latitud, longitud, estado, created_at)
SELECT
  c.id        AS cliente_id,
  v.empresa_id,
  v.direccion,
  v.latitud,
  v.longitud,
  COALESCE(v.estado, 1),
  v.created_at
FROM clientes_empresa_old v
INNER JOIN clientes c
  ON c.cedula = CASE
    WHEN TRIM(COALESCE(v.cedula, '')) = '' THEN CONCAT('sin-ci-', v.id)
    ELSE TRIM(v.cedula)
  END
ON DUPLICATE KEY UPDATE
  -- Si ya existe la relación (mismo cliente, misma empresa), no sobrescribir
  cliente_id = cliente_id;


-- ============================================================
-- PASO 7: Actualizar creditos.cliente_id para apuntar a los
--         nuevos IDs de la tabla clientes global.
--         empresa_id en creditos NO cambia — sigue igual.
-- ============================================================

UPDATE creditos cr
INNER JOIN clientes_empresa_old vb ON vb.id = cr.cliente_id
INNER JOIN clientes c
  ON c.cedula = CASE
    WHEN TRIM(COALESCE(vb.cedula, '')) = '' THEN CONCAT('sin-ci-', vb.id)
    ELSE TRIM(vb.cedula)
  END
SET cr.cliente_id = c.id;


-- ============================================================
-- PASO 8: Nuevas columnas en creditos para los campos del
--         formulario manual y la importación Excel ampliada.
-- ============================================================

ALTER TABLE creditos
  ADD COLUMN descripcion     VARCHAR(255) NULL
    COMMENT 'Descripción del producto financiado (ej: Tele Samsung 55")'
    AFTER numero_credito;

ALTER TABLE creditos
  ADD COLUMN precio_contado  DECIMAL(12,2) NULL
    COMMENT 'Precio de contado del bien financiado'
    AFTER descripcion;

ALTER TABLE creditos
  ADD COLUMN entrega_inicial DECIMAL(12,2) DEFAULT 0.00
    COMMENT 'Monto entregado al momento de la venta (enganche)'
    AFTER precio_contado;

ALTER TABLE creditos
  ADD COLUMN monto_cuota     DECIMAL(12,2) NULL
    COMMENT 'Monto fijo por cuota (calculado o indicado manualmente)'
    AFTER cantidad_cuotas;

ALTER TABLE creditos
  ADD COLUMN dia_pago        TINYINT UNSIGNED NULL
    COMMENT 'Día del mes en que vence cada cuota (1-31)'
    AFTER monto_cuota;

ALTER TABLE creditos
  ADD COLUMN cuotas_pagadas  SMALLINT UNSIGNED DEFAULT 0
    COMMENT 'Cantidad de cuotas ya pagadas al momento de importar'
    AFTER dia_pago;


-- ============================================================
-- PASO 9: Verificación final
-- ============================================================

SELECT 'clientes (global)'   AS tabla, COUNT(*) AS total FROM clientes
UNION ALL
SELECT 'clientes_empresas'   AS tabla, COUNT(*) AS total FROM clientes_empresas
UNION ALL
SELECT 'backup original'     AS tabla, COUNT(*) AS total FROM clientes_empresa_old
UNION ALL
SELECT 'creditos'            AS tabla, COUNT(*) AS total FROM creditos;

-- Verificar que no quedaron creditos con cliente_id huérfano:
SELECT COUNT(*) AS creditos_huerfanos
FROM creditos cr
LEFT JOIN clientes c ON c.id = cr.cliente_id
WHERE c.id IS NULL;

-- Ver clientes que son de más de una empresa:
SELECT c.cedula, c.nombre, c.apellido, COUNT(ce.empresa_id) AS num_empresas
FROM clientes c
INNER JOIN clientes_empresas ce ON ce.cliente_id = c.id
GROUP BY c.id
HAVING num_empresas > 1
ORDER BY num_empresas DESC
LIMIT 20;


-- ============================================================
-- RESUMEN DE CAMBIOS
-- ============================================================
-- clientes          → NUEVA (global, CI único, sin empresa_id)
-- clientes_empresas → NUEVA tabla pivot (cliente↔empresa + ubicación + zona)
-- clientes_empresa_old → backup de la tabla anterior
-- creditos          → +descripcion, +precio_contado, +entrega_inicial,
--                      +monto_cuota, +dia_pago, +cuotas_pagadas
--                      cliente_id ahora apunta a clientes global
-- ============================================================
