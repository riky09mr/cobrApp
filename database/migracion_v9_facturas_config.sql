-- ============================================================
-- Migracion v9: Sistema de Facturacion SIFEN/eKuaatia
-- Cumple con requisitos DNIT Paraguay (Res. General vigente 2026)
-- ============================================================
--
-- Tablas:
--   facturas_emisor    Membrete del contribuyente emisor (1:1 empresa)
--   facturas_timbrado  Timbrados autorizados por la DNIT  (N:1 empresa)
--                      Incluye establecimiento, punto de emision,
--                      rango autorizado y secuencia actual.
--                      Campo es_electronica controla si genera CDC/XML.
--   facturas           Cabecera de la factura emitida
--                      (FK directa a timbrado — registro historico legal)
--   facturas_detalle   Items / lineas de la factura
--   facturas_pago      Formas de pago (obligatorio si condicion=Contado)
--
-- ============================================================


-- ── 1. Emisor ─────────────────────────────────────────────────
-- Datos fiscales del contribuyente impresos en la factura.
-- Un solo registro por empresa; se edita cuando cambian los datos.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_emisor (
  id                  INT           NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT        NOT NULL,
  razon_social        VARCHAR(200)  NULL  COMMENT 'Razon social o nombre comercial',
  ruc                 VARCHAR(20)   NULL  COMMENT 'RUC sin digito verificador',
  ruc_dv              VARCHAR(1)    NULL  COMMENT 'Digito verificador del RUC',
  direccion           VARCHAR(255)  NULL,
  actividad_economica VARCHAR(255)  NULL,
  created_at          DATETIME      DEFAULT NOW(),
  updated_at          DATETIME      DEFAULT NOW() ON UPDATE NOW(),

  PRIMARY KEY (id),
  UNIQUE  KEY uq_fe_empresa (empresa_id),
  CONSTRAINT fk_fe_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE
) COMMENT 'Datos del emisor/contribuyente impresos en la factura';


-- ── 2. Timbrados ──────────────────────────────────────────────
-- Cada timbrado que la DNIT otorga a la empresa, con todos sus
-- parametros: establecimiento, punto de emision, rango autorizado
-- y secuencia actual.
--
-- Flujo de busqueda:
--   SELECT * FROM facturas_timbrado
--   WHERE empresa_id = ? AND activo = 1
--     AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_vencimiento
--   ORDER BY id DESC LIMIT 1
--
-- es_electronica = 0  Factura impresa en papel (solo PDF)
-- es_electronica = 1  Documento Electronico SIFEN (CDC + firma + QR)
--
-- numero_actual: proximo numero a utilizar (entre numero_desde y numero_hasta)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_timbrado (
  id                INT          NOT NULL AUTO_INCREMENT,
  empresa_id        BIGINT       NOT NULL,
  numero_timbrado   VARCHAR(20)  NOT NULL  COMMENT 'Numero de timbrado (8 digitos) asignado por DNIT',
  establecimiento   VARCHAR(3)   NOT NULL  DEFAULT '001'
                      COMMENT 'Tres digitos del establecimiento (ej: 001 = Casa Matriz)',
  punto_emision     VARCHAR(3)   NOT NULL  DEFAULT '001'
                      COMMENT 'Tres digitos del punto de emision (ej: 002 = Caja 2)',
  fecha_inicio      DATE         NULL      COMMENT 'Fecha de inicio de vigencia del timbrado',
  fecha_vencimiento DATE         NULL      COMMENT 'Fecha de vencimiento del timbrado',
  numero_desde      INT          NOT NULL  DEFAULT 1
                      COMMENT 'Numero inicial autorizado por la DNIT',
  numero_hasta      INT          NOT NULL  DEFAULT 9999999
                      COMMENT 'Numero final autorizado por la DNIT',
  numero_actual     INT          NOT NULL  DEFAULT 1
                      COMMENT 'Proximo numero secuencial a utilizar (7 digitos)',
  es_electronica    TINYINT(1)   NOT NULL  DEFAULT 0
                      COMMENT '0 = Impresa en papel  |  1 = Documento Electronico SIFEN',
  activo            TINYINT(1)   NOT NULL  DEFAULT 1
                      COMMENT '1 = timbrado actualmente en uso',
  created_at        DATETIME     DEFAULT NOW(),
  updated_at        DATETIME     DEFAULT NOW() ON UPDATE NOW(),

  PRIMARY KEY (id),
  CONSTRAINT fk_ft_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE
) COMMENT 'Timbrados autorizados por la DNIT — historial completo por empresa';


-- ── 3. Factura (Cabecera) ─────────────────────────────────────
-- Un registro por factura emitida.
-- timbrado_id apunta al timbrado vigente al momento de emision.
-- Esto garantiza la integridad historica aunque el timbrado venza.
--
-- Factura IMPRESA:  cdc, xml_firmado y estado_dnit son NULL.
-- Factura ELECTRONICA:
--   cdc        = 44 digitos calculados segun formula DNIT
--   xml_firmado = XML generado y firmado (almacenado para reenvio)
--   estado_dnit = PENDIENTE | APROBADO | RECHAZADO | ANULADO
--   tipo_emision = 1 Normal | 2 Contingencia
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                  INT            NOT NULL AUTO_INCREMENT,
  empresa_id          BIGINT         NOT NULL,
  timbrado_id         INT            NOT NULL  COMMENT 'FK al timbrado vigente al momento de emision',
  numero_secuencial   INT            NOT NULL  COMMENT 'Numero asignado a esta factura (7 digitos)',
  numero_completo     VARCHAR(15)    NOT NULL  COMMENT 'Formato: 001-001-0000001',

  -- Receptor
  visita_id           INT            NULL      COMMENT 'FK a visitas_cobro',
  cliente_id          INT            NOT NULL,
  cuota_id            INT            NOT NULL,

  -- Datos fiscales
  condicion_venta     TINYINT(1)     NOT NULL  DEFAULT 1
                        COMMENT '1 = Contado  |  2 = Credito',
  moneda              VARCHAR(3)     NOT NULL  DEFAULT 'PYG',

  -- Montos (IVA formula DNIT: iva10% = total / 11, iva5% = total / 21)
  monto_total         DECIMAL(15,0)  NOT NULL  DEFAULT 0,
  monto_base          DECIMAL(15,0)  NOT NULL  DEFAULT 0  COMMENT 'Base imponible (monto sin IVA)',
  monto_iva_10        DECIMAL(15,0)  NOT NULL  DEFAULT 0  COMMENT 'IVA 10%: round(total/11)',
  monto_iva_5         DECIMAL(15,0)  NOT NULL  DEFAULT 0  COMMENT 'IVA  5%: round(total/21)',
  monto_exento        DECIMAL(15,0)  NOT NULL  DEFAULT 0,

  -- Solo Factura Electronica SIFEN
  cdc                 VARCHAR(44)    NULL      COMMENT 'Codigo de Control 44 digitos — NULL si es impresa',
  tipo_emision        TINYINT(1)     NULL      COMMENT '1=Normal 2=Contingencia — NULL si es impresa',
  estado_dnit         VARCHAR(20)    NULL      COMMENT 'PENDIENTE|APROBADO|RECHAZADO|ANULADO — NULL si es impresa',
  xml_firmado         MEDIUMTEXT     NULL      COMMENT 'XML firmado almacenado para consulta/reenvio',

  anulada             TINYINT(1)     NOT NULL  DEFAULT 0,
  fecha_emision       DATETIME       NOT NULL  DEFAULT NOW(),
  created_at          DATETIME       DEFAULT NOW(),

  PRIMARY KEY (id),
  UNIQUE  KEY uq_f_visita (visita_id),
  UNIQUE  KEY uq_f_cdc    (cdc),
  CONSTRAINT fk_f_empresa  FOREIGN KEY (empresa_id)  REFERENCES empresas(id)           ON DELETE CASCADE,
  CONSTRAINT fk_f_timbrado FOREIGN KEY (timbrado_id) REFERENCES facturas_timbrado(id),
  CONSTRAINT fk_f_cliente  FOREIGN KEY (cliente_id)  REFERENCES clientes(id),
  CONSTRAINT fk_f_cuota    FOREIGN KEY (cuota_id)    REFERENCES cuotas(id)
) COMMENT 'Cabecera de las facturas emitidas (impresa o electronica SIFEN)';


-- ── 4. Detalle / Items de la factura ─────────────────────────
-- Una fila por cada bien o servicio facturado.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_detalle (
  id              INT            NOT NULL AUTO_INCREMENT,
  factura_id      INT            NOT NULL,
  codigo          VARCHAR(50)    NULL    COMMENT 'Codigo interno del producto/servicio',
  descripcion     VARCHAR(255)   NOT NULL,
  cantidad        DECIMAL(12,4)  NOT NULL  DEFAULT 1,
  precio_unitario DECIMAL(15,0)  NOT NULL  DEFAULT 0,
  iva_tipo        TINYINT(1)     NOT NULL  DEFAULT 1
                    COMMENT '1 = Gravado 10%  |  2 = Gravado 5%  |  3 = Exento',
  subtotal        DECIMAL(15,0)  NOT NULL  DEFAULT 0
                    COMMENT 'cantidad * precio_unitario (IVA incluido)',

  PRIMARY KEY (id),
  CONSTRAINT fk_fd_factura FOREIGN KEY (factura_id)
    REFERENCES facturas(id) ON DELETE CASCADE
) COMMENT 'Items de cada factura';


-- ── 5. Formas de pago ─────────────────────────────────────────
-- Obligatorio si condicion_venta = 1 (Contado).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_pago (
  id          INT            NOT NULL AUTO_INCREMENT,
  factura_id  INT            NOT NULL,
  tipo_pago   TINYINT(1)     NOT NULL
                COMMENT '1=Efectivo 2=Tarjeta 3=Cheque 4=Transferencia 5=Otro',
  monto       DECIMAL(15,0)  NOT NULL  DEFAULT 0,
  descripcion VARCHAR(100)   NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_fp_factura FOREIGN KEY (factura_id)
    REFERENCES facturas(id) ON DELETE CASCADE
) COMMENT 'Formas de pago de cada factura';


-- ── Inicializar emisor con datos actuales de empresas ─────────
INSERT INTO facturas_emisor (empresa_id, razon_social, ruc, direccion)
SELECT id, razon_social, ruc, direccion FROM empresas
ON DUPLICATE KEY UPDATE empresa_id = empresa_id;