-- =====================================================================
-- BASE DE DATOS: cobrApp
-- ESTructura completa generada el 2026-08-28T13:21:38.972Z
-- Cantidad de tablas: 50
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `cobrApp` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `cobrApp`;

-- cobrApp.arqueos definition

CREATE TABLE `arqueos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `caja_apertura_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `fecha_hora_arqueo` datetime NOT NULL,
  `saldo_sistema` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_declarado` decimal(14,2) NOT NULL DEFAULT '0.00',
  `diferencia` decimal(14,2) NOT NULL DEFAULT '0.00',
  `observaciones` text,
  `ip_origen` varchar(45) DEFAULT NULL,
  `gps_latitud` decimal(10,8) DEFAULT NULL,
  `gps_longitud` decimal(11,8) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_arqueo_apertura_fecha` (`caja_apertura_id`,`fecha_hora_arqueo`),
  KEY `idx_arqueo_cobrador_fecha` (`cobrador_id`,`fecha_hora_arqueo`),
  KEY `fk_arqueo_empresa_new` (`empresa_id`),
  KEY `fk_arqueo_caja_new` (`caja_id`),
  KEY `fk_arqueo_created_by` (`created_by`),
  KEY `fk_arqueo_updated_by` (`updated_by`),
  CONSTRAINT `fk_arqueo_apertura_new` FOREIGN KEY (`caja_apertura_id`) REFERENCES `caja_aperturas` (`id`),
  CONSTRAINT `fk_arqueo_caja_new` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_arqueo_cobrador_new` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_arqueo_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_arqueo_empresa_new` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_arqueo_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Arqueos historicos no eliminables';

-- cobrApp.arqueos_caja definition

CREATE TABLE `arqueos_caja` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `fecha_apertura` datetime NOT NULL,
  `fecha_cierre` datetime DEFAULT NULL,
  `saldo_inicial` decimal(12,2) DEFAULT '0.00',
  `saldo_esperado` decimal(12,2) DEFAULT '0.00',
  `saldo_contado` decimal(12,2) DEFAULT '0.00',
  `diferencia` decimal(12,2) DEFAULT '0.00',
  `observacion` text,
  `estado` enum('ABIERTO','CERRADO') DEFAULT 'ABIERTO',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `caja_id` bigint DEFAULT NULL,
  `caja_apertura_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_arqueo_empresa` (`empresa_id`),
  KEY `fk_arqueo_cobrador` (`cobrador_id`),
  KEY `idx_arqueo_caja_new_ref` (`caja_id`,`caja_apertura_id`),
  KEY `fk_arqueos_caja_apertura_new` (`caja_apertura_id`),
  CONSTRAINT `fk_arqueo_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_arqueo_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_arqueos_caja_apertura_new` FOREIGN KEY (`caja_apertura_id`) REFERENCES `caja_aperturas` (`id`),
  CONSTRAINT `fk_arqueos_caja_caja_new` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.asignaciones definition

CREATE TABLE `asignaciones` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cuota_id` bigint NOT NULL,
  `usuario_id` bigint NOT NULL,
  `supervisor_id` bigint DEFAULT NULL,
  `fecha_asignacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_limite` date DEFAULT NULL COMMENT 'Fecha límite para completar la cobranza',
  `estado` varchar(30) DEFAULT 'PENDIENTE',
  PRIMARY KEY (`id`),
  KEY `fk_asignacion_cuota` (`cuota_id`),
  KEY `fk_asignacion_usuario` (`usuario_id`),
  KEY `fk_asignaciones_supervisor` (`supervisor_id`),
  CONSTRAINT `fk_asignacion_cuota` FOREIGN KEY (`cuota_id`) REFERENCES `cuotas` (`id`),
  CONSTRAINT `fk_asignacion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_asignaciones_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2720 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.auditoria definition

CREATE TABLE `auditoria` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint DEFAULT NULL,
  `usuario_id` bigint DEFAULT NULL,
  `ip_origen` varchar(45) DEFAULT NULL,
  `tabla_afectada` varchar(100) DEFAULT NULL,
  `registro_id` bigint DEFAULT NULL,
  `accion` varchar(20) DEFAULT NULL,
  `detalle` text,
  `datos_antes` json DEFAULT NULL,
  `datos_despues` json DEFAULT NULL,
  `observaciones` text,
  `fecha_hora_evento` datetime DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auditoria_empresa_fecha` (`empresa_id`,`fecha_hora_evento`),
  KEY `idx_auditoria_tabla_registro` (`tabla_afectada`,`registro_id`),
  KEY `idx_auditoria_usuario_fecha` (`usuario_id`,`fecha_hora_evento`),
  CONSTRAINT `fk_auditoria_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.caja_aperturas definition

CREATE TABLE `caja_aperturas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `fecha_operacion` date NOT NULL,
  `fecha_hora_apertura` datetime NOT NULL,
  `saldo_inicial` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_actual` decimal(14,2) NOT NULL DEFAULT '0.00',
  `estado` enum('ABIERTA','CERRADA','ANULADA') NOT NULL DEFAULT 'ABIERTA',
  `ip_apertura` varchar(45) DEFAULT NULL,
  `gps_apertura_latitud` decimal(10,8) DEFAULT NULL,
  `gps_apertura_longitud` decimal(11,8) DEFAULT NULL,
  `observaciones` text,
  `legacy_arqueo_caja_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_apertura_empresa_fecha` (`empresa_id`,`fecha_operacion`),
  KEY `idx_apertura_caja_estado` (`caja_id`,`estado`),
  KEY `idx_apertura_cobrador_fecha` (`cobrador_id`,`fecha_operacion`),
  KEY `fk_apertura_created_by` (`created_by`),
  KEY `fk_apertura_updated_by` (`updated_by`),
  CONSTRAINT `fk_apertura_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_apertura_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_apertura_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_apertura_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_apertura_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Aperturas diarias de caja por cobrador';

-- cobrApp.caja_cambios definition

CREATE TABLE `caja_cambios` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `tipo_cambio` enum('ASIGNACION_COBRADOR','CAMBIO_COBRADOR','CAMBIO_PUNTO','BLOQUEO','DESBLOQUEO','CAMBIO_TIMBRADO') NOT NULL,
  `cobrador_anterior_id` bigint DEFAULT NULL,
  `cobrador_nuevo_id` bigint DEFAULT NULL,
  `punto_anterior_id` bigint DEFAULT NULL,
  `punto_nuevo_id` bigint DEFAULT NULL,
  `timbrado_anterior_id` bigint DEFAULT NULL,
  `timbrado_nuevo_id` bigint DEFAULT NULL,
  `observacion` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_caja_cambios_caja` (`caja_id`,`created_at`),
  KEY `fk_caja_cambio_empresa` (`empresa_id`),
  KEY `fk_caja_cambio_cobrador_ant` (`cobrador_anterior_id`),
  KEY `fk_caja_cambio_cobrador_new` (`cobrador_nuevo_id`),
  KEY `fk_caja_cambio_punto_ant` (`punto_anterior_id`),
  KEY `fk_caja_cambio_punto_new` (`punto_nuevo_id`),
  KEY `fk_caja_cambio_timbrado_ant` (`timbrado_anterior_id`),
  KEY `fk_caja_cambio_timbrado_new` (`timbrado_nuevo_id`),
  KEY `fk_caja_cambio_created_by` (`created_by`),
  KEY `fk_caja_cambio_updated_by` (`updated_by`),
  CONSTRAINT `fk_caja_cambio_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_caja_cambio_cobrador_ant` FOREIGN KEY (`cobrador_anterior_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_caja_cambio_cobrador_new` FOREIGN KEY (`cobrador_nuevo_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_caja_cambio_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_caja_cambio_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_caja_cambio_punto_ant` FOREIGN KEY (`punto_anterior_id`) REFERENCES `puntos_expedicion` (`id`),
  CONSTRAINT `fk_caja_cambio_punto_new` FOREIGN KEY (`punto_nuevo_id`) REFERENCES `puntos_expedicion` (`id`),
  CONSTRAINT `fk_caja_cambio_timbrado_ant` FOREIGN KEY (`timbrado_anterior_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_caja_cambio_timbrado_new` FOREIGN KEY (`timbrado_nuevo_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_caja_cambio_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Historial de cambios estructurales sobre la caja';

-- cobrApp.caja_movimientos definition

CREATE TABLE `caja_movimientos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `caja_apertura_id` bigint NOT NULL,
  `recibo_id` bigint DEFAULT NULL,
  `arqueo_id` bigint DEFAULT NULL,
  `cierre_caja_id` bigint DEFAULT NULL,
  `tipo_movimiento` enum('INGRESO','COBRANZA','EGRESO','AJUSTE','ANULACION','CIERRE') NOT NULL,
  `sentido_saldo` enum('SUMA','RESTA') NOT NULL,
  `importe` decimal(14,2) NOT NULL,
  `saldo_anterior` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_posterior` decimal(14,2) NOT NULL DEFAULT '0.00',
  `descripcion` varchar(255) NOT NULL,
  `referencia_tabla` varchar(100) DEFAULT NULL,
  `referencia_id` bigint DEFAULT NULL,
  `fecha_hora_movimiento` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mov_caja_apertura_fecha` (`caja_apertura_id`,`fecha_hora_movimiento`),
  KEY `idx_mov_tipo_fecha` (`tipo_movimiento`,`fecha_hora_movimiento`),
  KEY `idx_mov_recibo` (`recibo_id`),
  KEY `fk_mov_empresa` (`empresa_id`),
  KEY `fk_mov_caja` (`caja_id`),
  KEY `fk_mov_created_by` (`created_by`),
  KEY `fk_mov_updated_by` (`updated_by`),
  CONSTRAINT `fk_mov_apertura` FOREIGN KEY (`caja_apertura_id`) REFERENCES `caja_aperturas` (`id`),
  CONSTRAINT `fk_mov_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_mov_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_mov_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_mov_recibo` FOREIGN KEY (`recibo_id`) REFERENCES `recibos` (`id`),
  CONSTRAINT `fk_mov_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Libro mayor de caja con trazabilidad de saldos';

-- cobrApp.cajas definition

CREATE TABLE `cajas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `punto_expedicion_id` bigint NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `estado` enum('ACTIVA','BLOQUEADA','INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  `cobrador_asignado_id` bigint DEFAULT NULL,
  `saldo_inicial_referencia` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_actual` decimal(14,2) NOT NULL DEFAULT '0.00',
  `fecha_apertura_actual` datetime DEFAULT NULL,
  `fecha_cierre_actual` datetime DEFAULT NULL,
  `observaciones` text,
  `legacy_arqueo_caja_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_caja_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_caja_punto` (`punto_expedicion_id`),
  KEY `idx_caja_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_caja_cobrador` (`cobrador_asignado_id`),
  KEY `fk_caja_created_by` (`created_by`),
  KEY `fk_caja_updated_by` (`updated_by`),
  CONSTRAINT `fk_caja_cobrador` FOREIGN KEY (`cobrador_asignado_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_caja_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_caja_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_caja_punto` FOREIGN KEY (`punto_expedicion_id`) REFERENCES `puntos_expedicion` (`id`),
  CONSTRAINT `fk_caja_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Caja operativa asociada a un punto de expedicion';

-- cobrApp.cierres_caja definition

CREATE TABLE `cierres_caja` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `caja_apertura_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `fecha_hora_cierre` datetime NOT NULL,
  `saldo_inicial` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_ingresos` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_egresos` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_esperado` decimal(14,2) NOT NULL DEFAULT '0.00',
  `saldo_declarado` decimal(14,2) NOT NULL DEFAULT '0.00',
  `diferencia` decimal(14,2) NOT NULL DEFAULT '0.00',
  `observaciones` text,
  `ip_cierre` varchar(45) DEFAULT NULL,
  `gps_cierre_latitud` decimal(10,8) DEFAULT NULL,
  `gps_cierre_longitud` decimal(11,8) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cierre_apertura` (`caja_apertura_id`),
  KEY `idx_cierre_caja_fecha` (`caja_id`,`fecha_hora_cierre`),
  KEY `fk_cierre_empresa` (`empresa_id`),
  KEY `fk_cierre_cobrador` (`cobrador_id`),
  KEY `fk_cierre_created_by` (`created_by`),
  KEY `fk_cierre_updated_by` (`updated_by`),
  CONSTRAINT `fk_cierre_apertura` FOREIGN KEY (`caja_apertura_id`) REFERENCES `caja_aperturas` (`id`),
  CONSTRAINT `fk_cierre_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_cierre_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_cierre_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_cierre_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_cierre_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Resultado consolidado del cierre de una apertura';

-- cobrApp.clientes definition

CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cedula` varchar(20) NOT NULL COMMENT 'CI o RUC — identificador único global del cliente',
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clientes_cedula` (`cedula`)
) ENGINE=InnoDB AUTO_INCREMENT=501 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Clientes globales — un registro por persona/empresa identificada por CI/RUC';

-- cobrApp.clientes_empresa_old definition

CREATE TABLE `clientes_empresa_old` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `cedula` varchar(30) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_cliente_empresa` (`empresa_id`),
  CONSTRAINT `fk_cliente_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.clientes_empresas definition

CREATE TABLE `clientes_empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL COMMENT 'Mismo tipo que clientes.id (INT)',
  `empresa_id` bigint NOT NULL COMMENT 'Mismo tipo que empresas.id (BIGINT)',
  `direccion` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  `id_lote` bigint DEFAULT NULL COMMENT 'Lote de importaci├│n que cre├│/actualiz├│ esta relaci├│n cliente-empresa',
  `zona_id` bigint DEFAULT NULL COMMENT 'Mismo tipo que zonas.id (BIGINT)',
  `estado` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cliente_empresa` (`cliente_id`,`empresa_id`),
  KEY `fk_ce_empresa` (`empresa_id`),
  KEY `fk_ce_zona` (`zona_id`),
  KEY `fk_ce_lote` (`id_lote`),
  CONSTRAINT `fk_ce_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ce_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ce_lote` FOREIGN KEY (`id_lote`) REFERENCES `lotes_importacion` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ce_zona` FOREIGN KEY (`zona_id`) REFERENCES `zonas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=501 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Relación cliente↔empresa: cada empresa ve solo sus clientes con sus datos geográficos';

-- cobrApp.comprobantes definition

CREATE TABLE `comprobantes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `pago_id` bigint NOT NULL,
  `url_archivo` varchar(500) NOT NULL COMMENT 'Ruta o URL del archivo subido',
  `tipo` varchar(50) DEFAULT 'imagen' COMMENT 'imagen | pdf | otro',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_comprobantes_pago` (`pago_id`),
  CONSTRAINT `fk_comprobantes_pago` FOREIGN KEY (`pago_id`) REFERENCES `pagos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Evidencias fotográficas o documentales de pagos registrados';

-- cobrApp.creditos definition

CREATE TABLE `creditos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `cliente_id` int DEFAULT NULL,
  `numero_credito` varchar(100) DEFAULT NULL COMMENT 'Código o número de referencia del crédito (único por empresa)',
  `descripcion` varchar(255) DEFAULT NULL COMMENT 'Descripción del producto financiado (ej: Tele Samsung 55")',
  `precio_contado` decimal(12,2) DEFAULT NULL COMMENT 'Precio de contado del bien financiado',
  `entrega_inicial` decimal(12,2) DEFAULT '0.00' COMMENT 'Monto entregado al momento de la venta (enganche)',
  `monto_total` decimal(12,2) NOT NULL,
  `saldo_actual` decimal(12,2) NOT NULL,
  `cantidad_cuotas` int NOT NULL,
  `monto_cuota` decimal(12,2) DEFAULT NULL COMMENT 'Monto fijo por cuota (calculado o indicado manualmente)',
  `dia_pago` tinyint unsigned DEFAULT NULL COMMENT 'Día del mes en que vence cada cuota (1-31)',
  `cuotas_pagadas` smallint unsigned DEFAULT '0' COMMENT 'Cantidad de cuotas ya pagadas al momento de importar',
  `tasa_interes` decimal(5,2) DEFAULT '0.00' COMMENT 'Tasa de interés anual en porcentaje',
  `periodicidad` enum('SEMANAL','QUINCENAL','MENSUAL') DEFAULT 'MENSUAL' COMMENT 'Frecuencia de pago de las cuotas',
  `fecha_otorgamiento` date DEFAULT NULL,
  `estado` varchar(30) DEFAULT 'ACTIVO',
  `id_lote` bigint DEFAULT NULL COMMENT 'Lote de importaci├│n al que pertenece este cr├®dito',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_credito_empresa` (`empresa_id`,`numero_credito`),
  KEY `fk_credito_cliente` (`cliente_id`),
  KEY `fk_credito_lote` (`id_lote`),
  CONSTRAINT `fk_credito_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_credito_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_credito_lote` FOREIGN KEY (`id_lote`) REFERENCES `lotes_importacion` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=501 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.cuotas definition

CREATE TABLE `cuotas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `credito_id` bigint NOT NULL,
  `numero_cuota` int NOT NULL,
  `fecha_vencimiento` date NOT NULL,
  `monto_cuota` decimal(12,2) NOT NULL,
  `saldo_cuota` decimal(12,2) NOT NULL,
  `estado` varchar(30) DEFAULT 'PENDIENTE',
  `fecha_pago` date DEFAULT NULL COMMENT 'Fecha real en que fue pagada la cuota',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `interes_acumulado` decimal(12,2) NOT NULL DEFAULT '0.00',
  `dias_retraso` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_cuota_credito` (`credito_id`),
  CONSTRAINT `fk_cuota_credito` FOREIGN KEY (`credito_id`) REFERENCES `creditos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5754 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.descansos_cobrador definition

CREATE TABLE `descansos_cobrador` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tipo_descanso_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio_real` datetime NOT NULL,
  `hora_fin_real` datetime DEFAULT NULL,
  `duracion_minutos` int DEFAULT NULL COMMENT 'Duración en minutos del descanso (calculada al finalizar)',
  `activado_auto` tinyint(1) DEFAULT '0',
  `comentario` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dc_cobrador_fecha` (`cobrador_id`,`fecha`),
  KEY `idx_dc_tipo` (`tipo_descanso_id`),
  CONSTRAINT `fk_dc_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dc_tipo` FOREIGN KEY (`tipo_descanso_id`) REFERENCES `tipos_descanso` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.empresas definition

CREATE TABLE `empresas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `razon_social` varchar(150) NOT NULL,
  `ruc` varchar(30) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL COMMENT 'Ruta relativa al logo de la empresa (ej: /uploads/logos/empresa_1.png)',
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.empresas_feriados definition

CREATE TABLE `empresas_feriados` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `fecha` date NOT NULL,
  `fecha_original` date DEFAULT NULL COMMENT 'Fecha original del feriado (referencia para el reset anual)',
  `descripcion` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  `origen` varchar(50) NOT NULL DEFAULT 'MANUAL' COMMENT 'Origen del feriado: MANUAL, jueves_santo, viernes_santo, traslado_heroes, traslado_paz_chaco, traslado_fundacion_asuncion',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feriado_empresa_fecha` (`empresa_id`,`fecha`),
  KEY `idx_feriado_empresa` (`empresa_id`),
  KEY `idx_feriado_empresa_fecha` (`empresa_id`,`fecha`),
  KEY `fk_feriado_created_by` (`created_by`),
  KEY `fk_feriado_updated_by` (`updated_by`),
  CONSTRAINT `fk_feriado_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_feriado_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_feriado_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=370 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Feriados locales por empresa';

-- cobrApp.empresas_intereses_config definition

CREATE TABLE `empresas_intereses_config` (
  `empresa_id` bigint NOT NULL,
  `generar_interes` tinyint(1) NOT NULL DEFAULT '0',
  `dias_gracia` int NOT NULL DEFAULT '0',
  `porcentaje_interes_diario` decimal(6,4) NOT NULL DEFAULT '0.0000',
  `contar_domingos` tinyint(1) NOT NULL DEFAULT '0',
  `contar_feriados` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`empresa_id`),
  KEY `fk_interes_config_created_by` (`created_by`),
  KEY `fk_interes_config_updated_by` (`updated_by`),
  CONSTRAINT `fk_interes_config_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_interes_config_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_interes_config_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Configuracion de dias de luz e intereses por empresa';

-- cobrApp.establecimientos definition

CREATE TABLE `establecimientos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` bigint DEFAULT NULL,
  `codigo` char(3) NOT NULL,
  `descripcion` varchar(150) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_establecimiento_empresa_codigo` (`empresa_id`,`codigo`),
  KEY `idx_establecimiento_timbrado` (`timbrado_id`),
  KEY `idx_establecimiento_empresa_activo` (`empresa_id`,`activo`),
  KEY `fk_establecimiento_created_by` (`created_by`),
  KEY `fk_establecimiento_updated_by` (`updated_by`),
  CONSTRAINT `fk_establecimiento_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_establecimiento_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_establecimiento_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_establecimiento_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Establecimientos fiscales de la empresa';

-- cobrApp.excepciones_horario definition

CREATE TABLE `excepciones_horario` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cobrador_id` bigint NOT NULL,
  `empresa_id` bigint NOT NULL,
  `fecha` date NOT NULL COMMENT 'Fecha de la excepción',
  `tipo` enum('LIBRE','HORARIO_ESPECIAL') NOT NULL DEFAULT 'LIBRE',
  `hora_inicio` time DEFAULT NULL COMMENT 'Solo para HORARIO_ESPECIAL',
  `hora_fin` time DEFAULT NULL COMMENT 'Solo para HORARIO_ESPECIAL',
  `motivo` varchar(255) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_excepcion_fecha` (`cobrador_id`,`fecha`),
  KEY `fk_exc_empresa` (`empresa_id`),
  KEY `fk_exc_creado_by` (`created_by`),
  KEY `idx_exc_cobrador_fecha` (`cobrador_id`,`fecha`),
  CONSTRAINT `fk_exc_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exc_creado_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_exc_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Excepciones al horario habitual (días libres o con horario especial)';

-- cobrApp.facturas definition

CREATE TABLE `facturas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` int NOT NULL,
  `numero_secuencial` int NOT NULL COMMENT 'Numero asignado a esta factura (7 digitos)',
  `numero_completo` varchar(15) NOT NULL COMMENT 'Formato: 001-001-0000001',
  `visita_id` int DEFAULT NULL COMMENT 'FK a visitas_cobro',
  `cliente_id` int NOT NULL,
  `cuota_id` bigint NOT NULL,
  `condicion_venta` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = Contado | 2 = Credito',
  `moneda` varchar(3) NOT NULL DEFAULT 'PYG',
  `monto_total` decimal(15,0) NOT NULL DEFAULT '0',
  `monto_base` decimal(15,0) NOT NULL DEFAULT '0' COMMENT 'Base imponible (monto sin IVA)',
  `monto_iva_10` decimal(15,0) NOT NULL DEFAULT '0' COMMENT 'IVA 10%: round(total/11)',
  `monto_iva_5` decimal(15,0) NOT NULL DEFAULT '0' COMMENT 'IVA 5%: round(total/21)',
  `monto_exento` decimal(15,0) NOT NULL DEFAULT '0',
  `cdc` varchar(44) DEFAULT NULL COMMENT 'Codigo de Control de 44 digitos',
  `tipo_emision` tinyint(1) DEFAULT NULL COMMENT '1=Normal 2=Contingencia',
  `estado_dnit` varchar(20) DEFAULT NULL COMMENT 'PENDIENTE|APROBADO|RECHAZADO|ANULADO',
  `xml_firmado` mediumtext COMMENT 'XML firmado almacenado para consulta/reenvio',
  `anulada` tinyint(1) NOT NULL DEFAULT '0',
  `fecha_emision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_f_visita` (`visita_id`),
  UNIQUE KEY `uq_f_cdc` (`cdc`),
  KEY `fk_f_empresa` (`empresa_id`),
  KEY `fk_f_timbrado` (`timbrado_id`),
  KEY `fk_f_cliente` (`cliente_id`),
  KEY `fk_f_cuota` (`cuota_id`),
  CONSTRAINT `fk_f_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_f_cuota` FOREIGN KEY (`cuota_id`) REFERENCES `cuotas` (`id`),
  CONSTRAINT `fk_f_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_f_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `facturas_timbrado` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Cabecera de las facturas emitidas (impresa o electrónica SIFEN)';

-- cobrApp.facturas_detalle definition

CREATE TABLE `facturas_detalle` (
  `id` int NOT NULL AUTO_INCREMENT,
  `factura_id` int NOT NULL,
  `codigo` varchar(50) DEFAULT NULL COMMENT 'Codigo interno del producto/servicio',
  `descripcion` varchar(255) NOT NULL,
  `cantidad` decimal(12,4) NOT NULL DEFAULT '1.0000',
  `precio_unitario` decimal(15,0) NOT NULL DEFAULT '0',
  `iva_tipo` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = Gravado 10%  |  2 = Gravado 5%  |  3 = Exento',
  `subtotal` decimal(15,0) NOT NULL DEFAULT '0' COMMENT 'cantidad * precio_unitario (IVA incluido)',
  PRIMARY KEY (`id`),
  KEY `fk_fd_factura` (`factura_id`),
  CONSTRAINT `fk_fd_factura` FOREIGN KEY (`factura_id`) REFERENCES `facturas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Items de cada factura';

-- cobrApp.facturas_emisor definition

CREATE TABLE `facturas_emisor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `razon_social` varchar(200) DEFAULT NULL COMMENT 'Razon social o nombre comercial',
  `ruc` varchar(20) DEFAULT NULL COMMENT 'RUC sin digito verificador',
  `ruc_dv` varchar(1) DEFAULT NULL COMMENT 'Digito verificador del RUC',
  `direccion` varchar(255) DEFAULT NULL,
  `actividad_economica` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fe_empresa` (`empresa_id`),
  CONSTRAINT `fk_fe_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Datos del emisor/contribuyente impresos en la factura';

-- cobrApp.facturas_nota_credito definition

CREATE TABLE `facturas_nota_credito` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` int NOT NULL COMMENT 'FK a facturas_timbrado ÔÇö timbrado especifico para NC',
  `factura_id` int DEFAULT NULL COMMENT 'Factura original que esta NC anula ÔÇö NULL si es por recibo',
  `recibo_id` bigint DEFAULT NULL COMMENT 'FK recibos.id ÔÇö recibo que genero la NC por sobrepago',
  `numero_secuencial` int NOT NULL COMMENT 'Numero secuencial asignado por el timbrado de la NC',
  `numero_nc` varchar(15) NOT NULL COMMENT 'Formato 001-001-0000001 (establecimiento-punto-secuencial)',
  `cdc_nc` varchar(44) DEFAULT NULL COMMENT 'Codigo de Control 44 digitos ÔÇö NULL si es impresa',
  `estado_dnit` varchar(20) DEFAULT NULL COMMENT 'PENDIENTE | APROBADO | RECHAZADO ÔÇö NULL si es impresa',
  `monto_anulado` decimal(15,0) NOT NULL DEFAULT '0' COMMENT 'Monto total que revierte (puede ser parcial en creditos a cuenta)',
  `monto_sobrepago` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Excedente pagado sobre el total del recibo',
  `saldo_a_favor` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Saldo a favor del cliente generado por el sobrepago',
  `monto_iva_10` decimal(15,0) NOT NULL DEFAULT '0',
  `monto_iva_5` decimal(15,0) NOT NULL DEFAULT '0',
  `monto_exento` decimal(15,0) NOT NULL DEFAULT '0',
  `motivo` varchar(255) NOT NULL DEFAULT '' COMMENT 'Descripcion del motivo de la anulacion (requerida por DNIT)',
  `fecha_emision` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nc_cdc` (`cdc_nc`),
  KEY `fk_nc_timbrado` (`timbrado_id`),
  KEY `idx_nc_empresa` (`empresa_id`),
  KEY `idx_nc_factura` (`factura_id`),
  KEY `idx_nc_recibo` (`recibo_id`),
  CONSTRAINT `fk_nc_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_nc_factura` FOREIGN KEY (`factura_id`) REFERENCES `facturas` (`id`),
  CONSTRAINT `fk_nc_recibo` FOREIGN KEY (`recibo_id`) REFERENCES `recibos` (`id`),
  CONSTRAINT `fk_nc_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `facturas_timbrado` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Notas de Credito emitidas para anulacion de facturas o recibos (impresa o SIFEN)';

-- cobrApp.facturas_pago definition

CREATE TABLE `facturas_pago` (
  `id` int NOT NULL AUTO_INCREMENT,
  `factura_id` int NOT NULL,
  `tipo_pago` tinyint(1) NOT NULL COMMENT '1=Efectivo 2=Tarjeta 3=Cheque 4=Transferencia 5=Otro',
  `monto` decimal(15,0) NOT NULL DEFAULT '0',
  `descripcion` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_fp_factura` (`factura_id`),
  CONSTRAINT `fk_fp_factura` FOREIGN KEY (`factura_id`) REFERENCES `facturas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Formas de pago de cada factura';

-- cobrApp.facturas_timbrado definition

CREATE TABLE `facturas_timbrado` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `numero_timbrado` varchar(20) NOT NULL COMMENT 'Numero de timbrado (8 digitos) asignado por DNIT',
  `establecimiento` varchar(3) NOT NULL DEFAULT '001' COMMENT 'Tres digitos del establecimiento (ej: 001 = Casa Matriz)',
  `punto_emision` varchar(3) NOT NULL DEFAULT '001' COMMENT 'Tres digitos del punto de emision (ej: 002 = Caja 2)',
  `fecha_inicio` date DEFAULT NULL COMMENT 'Fecha de inicio de vigencia del timbrado',
  `fecha_vencimiento` date DEFAULT NULL COMMENT 'Fecha de vencimiento del timbrado',
  `numero_desde` int NOT NULL DEFAULT '1' COMMENT 'Numero inicial autorizado por la DNIT',
  `numero_hasta` int NOT NULL DEFAULT '9999999' COMMENT 'Numero final autorizado por la DNIT',
  `numero_actual` int NOT NULL DEFAULT '1' COMMENT 'Proximo numero secuencial a utilizar (7 digitos)',
  `es_electronica` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Impresa en papel  |  1 = Documento Electronico SIFEN',
  `activo` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = timbrado actualmente en uso',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ft_empresa` (`empresa_id`),
  CONSTRAINT `fk_ft_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Timbrados autorizados por la DNIT — historial completo por empresa';

-- cobrApp.horarios_cobrador definition

CREATE TABLE `horarios_cobrador` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cobrador_id` bigint NOT NULL,
  `empresa_id` bigint NOT NULL,
  `dia_semana` tinyint NOT NULL COMMENT '0=Dom 1=Lun 2=Mar 3=Mie 4=Jue 5=Vie 6=Sab',
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `created_by` bigint DEFAULT NULL COMMENT 'Supervisor que creó el horario',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_horario_dia` (`cobrador_id`,`dia_semana`),
  KEY `fk_hc_creado_by` (`created_by`),
  KEY `idx_hc_empresa` (`empresa_id`),
  KEY `idx_hc_cobrador` (`cobrador_id`),
  CONSTRAINT `fk_hc_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hc_creado_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hc_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Horario laboral semanal de cada cobrador, configurado por el supervisor';

-- cobrApp.lotes_importacion definition

CREATE TABLE `lotes_importacion` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL COMMENT 'FK empresas.id',
  `usuario_id` bigint NOT NULL COMMENT 'FK usuarios.id (qui├®n import├│)',
  `nombre_archivo` varchar(255) DEFAULT NULL COMMENT 'Nombre original del archivo Excel',
  `total_filas` int NOT NULL DEFAULT '0',
  `clientes_nuevos` int NOT NULL DEFAULT '0',
  `clientes_actualizados` int NOT NULL DEFAULT '0',
  `creditos_creados` int NOT NULL DEFAULT '0',
  `errores` int NOT NULL DEFAULT '0',
  `fecha_importacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('ACTIVO','ELIMINADO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id`),
  KEY `idx_lote_empresa` (`empresa_id`),
  KEY `idx_lote_usuario` (`usuario_id`),
  KEY `idx_lote_fecha` (`fecha_importacion`),
  CONSTRAINT `fk_lote_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_lote_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lotes de importaci├│n masiva de clientes y cr├®ditos';

-- cobrApp.medios_pago definition

CREATE TABLE `medios_pago` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `nombre` varchar(80) NOT NULL,
  `requiere_comprobante` tinyint(1) DEFAULT '0',
  `activo` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_mp_empresa` (`empresa_id`),
  CONSTRAINT `fk_mp_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.mensajes definition

CREATE TABLE `mensajes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `emisor_id` bigint NOT NULL,
  `receptor_id` bigint NOT NULL,
  `contenido` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `imagen_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `leido` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `empresa_id` (`empresa_id`),
  KEY `idx_receptor_leido` (`receptor_id`,`leido`),
  KEY `idx_conv` (`emisor_id`,`receptor_id`),
  CONSTRAINT `mensajes_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensajes_ibfk_2` FOREIGN KEY (`emisor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensajes_ibfk_3` FOREIGN KEY (`receptor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- cobrApp.movimientos_caja definition

CREATE TABLE `movimientos_caja` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `arqueo_id` bigint NOT NULL,
  `concepto` varchar(200) NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `fecha_hora` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_mov_arqueo` (`arqueo_id`),
  CONSTRAINT `fk_mov_arqueo` FOREIGN KEY (`arqueo_id`) REFERENCES `arqueos_caja` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.notificaciones definition

CREATE TABLE `notificaciones` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint NOT NULL,
  `titulo` varchar(150) DEFAULT NULL,
  `mensaje` text,
  `tipo` varchar(50) DEFAULT 'SISTEMA' COMMENT 'Tipo: ASIGNACION | VENCIMIENTO | PAGO | SISTEMA',
  `leida` tinyint(1) DEFAULT '0',
  `leida_at` datetime DEFAULT NULL COMMENT 'Timestamp exacto en que fue leída',
  `fecha_envio` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notificacion_usuario` (`usuario_id`),
  CONSTRAINT `fk_notificacion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.numeradores definition

CREATE TABLE `numeradores` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` bigint NOT NULL,
  `establecimiento_id` bigint NOT NULL,
  `punto_expedicion_id` bigint NOT NULL,
  `tipo_documento` enum('RECIBO_COBRANZA','FACTURA_CONTADO','FACTURA_CREDITO','NOTA_CREDITO') NOT NULL DEFAULT 'RECIBO_COBRANZA',
  `serie` varchar(20) NOT NULL DEFAULT 'A1',
  `numero_desde` bigint NOT NULL DEFAULT '1',
  `numero_hasta` bigint NOT NULL DEFAULT '9999999',
  `ultimo_numero_asignado` bigint NOT NULL DEFAULT '0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `bloqueado` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_numerador_scope` (`empresa_id`,`timbrado_id`,`establecimiento_id`,`punto_expedicion_id`,`tipo_documento`,`serie`),
  KEY `idx_numerador_punto_activo` (`punto_expedicion_id`,`activo`,`bloqueado`),
  KEY `fk_numerador_timbrado` (`timbrado_id`),
  KEY `fk_numerador_establecimiento` (`establecimiento_id`),
  KEY `fk_numerador_created_by` (`created_by`),
  KEY `fk_numerador_updated_by` (`updated_by`),
  CONSTRAINT `fk_numerador_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_numerador_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_numerador_establecimiento` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimientos` (`id`),
  CONSTRAINT `fk_numerador_punto` FOREIGN KEY (`punto_expedicion_id`) REFERENCES `puntos_expedicion` (`id`),
  CONSTRAINT `fk_numerador_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_numerador_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Secuencias fiscales por punto de expedicion y tipo de documento';

-- cobrApp.pagos definition

CREATE TABLE `pagos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cuota_id` bigint NOT NULL,
  `gestion_id` int DEFAULT NULL COMMENT 'Gestión durante la cual se recibió el pago',
  `usuario_id` bigint NOT NULL,
  `monto_pagado` decimal(12,2) NOT NULL,
  `fecha_pago` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metodo_pago` varchar(50) DEFAULT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pago_cuota` (`cuota_id`),
  KEY `fk_pago_usuario` (`usuario_id`),
  CONSTRAINT `fk_pago_cuota` FOREIGN KEY (`cuota_id`) REFERENCES `cuotas` (`id`),
  CONSTRAINT `fk_pago_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.permisos definition

CREATE TABLE `permisos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `modulo` varchar(50) NOT NULL COMMENT 'Modulo: clientes, cobranzas, gestiones, usuarios, etc.',
  `accion` varchar(20) NOT NULL COMMENT 'Accion: ver, crear, editar, eliminar',
  `descripcion` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permiso` (`modulo`,`accion`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Catalogo de permisos por modulo y accion';

-- cobrApp.puntos_expedicion definition

CREATE TABLE `puntos_expedicion` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` bigint NOT NULL,
  `establecimiento_id` bigint NOT NULL,
  `codigo` char(3) NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_punto_establecimiento_codigo` (`establecimiento_id`,`codigo`),
  KEY `idx_punto_empresa_activo` (`empresa_id`,`activo`),
  KEY `idx_punto_timbrado` (`timbrado_id`),
  KEY `fk_punto_created_by` (`created_by`),
  KEY `fk_punto_updated_by` (`updated_by`),
  CONSTRAINT `fk_punto_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_punto_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_punto_establecimiento` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimientos` (`id`),
  CONSTRAINT `fk_punto_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_punto_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Puntos de expedicion por establecimiento';

-- cobrApp.push_tokens definition

CREATE TABLE `push_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint NOT NULL COMMENT 'FK usuarios.id',
  `token` varchar(255) NOT NULL COMMENT 'Expo Push Token',
  `plataforma` varchar(20) DEFAULT NULL COMMENT 'android | ios',
  `ultimo_uso` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_token` (`token`),
  KEY `idx_push_usuario` (`usuario_id`),
  CONSTRAINT `fk_push_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tokens de notificaciones push por dispositivo';

-- cobrApp.recibo_detalles definition

CREATE TABLE `recibo_detalles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `recibo_id` bigint NOT NULL,
  `cuota_id` bigint DEFAULT NULL,
  `credito_id` bigint DEFAULT NULL,
  `concepto` varchar(255) NOT NULL,
  `cantidad` decimal(12,2) NOT NULL DEFAULT '1.00',
  `monto_unitario` decimal(14,2) NOT NULL DEFAULT '0.00',
  `monto_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `orden_detalle` int NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recibo_detalle_recibo` (`recibo_id`,`orden_detalle`),
  KEY `idx_recibo_detalle_cuota` (`cuota_id`),
  KEY `fk_recibo_detalle_credito` (`credito_id`),
  KEY `fk_recibo_detalle_created_by` (`created_by`),
  KEY `fk_recibo_detalle_updated_by` (`updated_by`),
  CONSTRAINT `fk_recibo_detalle_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_recibo_detalle_credito` FOREIGN KEY (`credito_id`) REFERENCES `creditos` (`id`),
  CONSTRAINT `fk_recibo_detalle_cuota` FOREIGN KEY (`cuota_id`) REFERENCES `cuotas` (`id`),
  CONSTRAINT `fk_recibo_detalle_recibo` FOREIGN KEY (`recibo_id`) REFERENCES `recibos` (`id`),
  CONSTRAINT `fk_recibo_detalle_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Detalle de conceptos cobrados por recibo';

-- cobrApp.recibos definition

CREATE TABLE `recibos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `timbrado_id` bigint NOT NULL,
  `establecimiento_id` bigint NOT NULL,
  `punto_expedicion_id` bigint NOT NULL,
  `caja_id` bigint NOT NULL,
  `caja_apertura_id` bigint NOT NULL,
  `cobrador_id` bigint NOT NULL,
  `cliente_id` int NOT NULL,
  `numerador_id` bigint NOT NULL,
  `visita_cobro_id` bigint DEFAULT NULL,
  `factura_legacy_id` int DEFAULT NULL,
  `nota_credito_id` bigint DEFAULT NULL COMMENT 'FK facturas_nota_credito.id ÔÇö NC generada por sobrepago',
  `aplico_nota_credito` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = se aplico nota de credito a este recibo',
  `monto_sobrepago` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Excedente pagado sobre el saldo de la cuota',
  `saldo_a_favor` decimal(14,2) NOT NULL DEFAULT '0.00' COMMENT 'Saldo a favor del cliente generado por el sobrepago',
  `numero_secuencia` bigint NOT NULL,
  `numero_recibo` varchar(25) NOT NULL,
  `estado` enum('EMITIDO','ANULADO','REVERSADO','CONTINGENCIA') NOT NULL DEFAULT 'EMITIDO',
  `fecha_emision` datetime NOT NULL,
  `moneda` char(3) NOT NULL DEFAULT 'PYG',
  `total_recibo` decimal(14,2) NOT NULL DEFAULT '0.00',
  `observaciones` text,
  `motivo_anulacion` varchar(255) DEFAULT NULL,
  `fecha_anulacion` datetime DEFAULT NULL,
  `tipo_emision` enum('IMPRESO','ELECTRONICO') NOT NULL DEFAULT 'IMPRESO',
  `cdc` varchar(44) DEFAULT NULL,
  `xml_firmado` longtext,
  `hash_documento` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recibo_numero` (`empresa_id`,`numero_recibo`),
  UNIQUE KEY `uq_recibo_cdc` (`cdc`),
  UNIQUE KEY `uq_recibo_visita` (`visita_cobro_id`),
  KEY `idx_recibo_empresa_fecha` (`empresa_id`,`fecha_emision`),
  KEY `idx_recibo_caja_apertura` (`caja_apertura_id`),
  KEY `idx_recibo_cliente` (`cliente_id`),
  KEY `fk_recibo_timbrado` (`timbrado_id`),
  KEY `fk_recibo_establecimiento` (`establecimiento_id`),
  KEY `fk_recibo_punto` (`punto_expedicion_id`),
  KEY `fk_recibo_caja` (`caja_id`),
  KEY `fk_recibo_cobrador` (`cobrador_id`),
  KEY `fk_recibo_numerador` (`numerador_id`),
  KEY `fk_recibo_factura_legacy` (`factura_legacy_id`),
  KEY `fk_recibo_created_by` (`created_by`),
  KEY `fk_recibo_updated_by` (`updated_by`),
  KEY `idx_recibo_estado_anulacion` (`estado`,`fecha_anulacion`),
  CONSTRAINT `fk_recibo_apertura` FOREIGN KEY (`caja_apertura_id`) REFERENCES `caja_aperturas` (`id`),
  CONSTRAINT `fk_recibo_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_recibo_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_recibo_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_recibo_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_recibo_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_recibo_establecimiento` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimientos` (`id`),
  CONSTRAINT `fk_recibo_factura_legacy` FOREIGN KEY (`factura_legacy_id`) REFERENCES `facturas` (`id`),
  CONSTRAINT `fk_recibo_numerador` FOREIGN KEY (`numerador_id`) REFERENCES `numeradores` (`id`),
  CONSTRAINT `fk_recibo_punto` FOREIGN KEY (`punto_expedicion_id`) REFERENCES `puntos_expedicion` (`id`),
  CONSTRAINT `fk_recibo_timbrado` FOREIGN KEY (`timbrado_id`) REFERENCES `timbrados` (`id`),
  CONSTRAINT `fk_recibo_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_recibo_visita` FOREIGN KEY (`visita_cobro_id`) REFERENCES `visitas_cobro` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Recibos fiscales y operativos emitidos por cobranzas';

-- cobrApp.rendiciones definition

CREATE TABLE `rendiciones` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `arqueo_id` bigint NOT NULL,
  `supervisor_id` bigint NOT NULL,
  `monto_recibido` decimal(12,2) NOT NULL,
  `fecha_rendicion` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('CUADRADO','SOBRANTE','FALTANTE') NOT NULL,
  `observacion` text,
  PRIMARY KEY (`id`),
  KEY `fk_rend_arqueo` (`arqueo_id`),
  KEY `fk_rend_supervisor` (`supervisor_id`),
  CONSTRAINT `fk_rend_arqueo` FOREIGN KEY (`arqueo_id`) REFERENCES `arqueos_caja` (`id`),
  CONSTRAINT `fk_rend_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.rol_permisos definition

CREATE TABLE `rol_permisos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rol_id` int NOT NULL COMMENT 'FK roles.id',
  `permiso_id` bigint NOT NULL COMMENT 'FK permisos.id',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rol_permiso` (`rol_id`,`permiso_id`),
  KEY `idx_rp_rol` (`rol_id`),
  KEY `idx_rp_permiso` (`permiso_id`),
  CONSTRAINT `fk_rp_permiso` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Permisos por defecto de cada rol';

-- cobrApp.roles definition

CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.saldos_a_favor definition

CREATE TABLE `saldos_a_favor` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `cliente_id` int NOT NULL,
  `recibo_id` bigint DEFAULT NULL COMMENT 'Recibo que genero el saldo a favor',
  `monto` decimal(14,2) NOT NULL DEFAULT '0.00',
  `estado` enum('DISPONIBLE','APLICADO','ANULADO') NOT NULL DEFAULT 'DISPONIBLE',
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_aplicacion` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_saf_cliente_estado` (`cliente_id`,`estado`),
  KEY `idx_saf_recibo` (`recibo_id`),
  KEY `fk_saf_empresa` (`empresa_id`),
  KEY `fk_saf_created_by` (`created_by`),
  KEY `fk_saf_updated_by` (`updated_by`),
  CONSTRAINT `fk_saf_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_saf_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_saf_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_saf_recibo` FOREIGN KEY (`recibo_id`) REFERENCES `recibos` (`id`),
  CONSTRAINT `fk_saf_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Saldos a favor del cliente generados por sobrepagos';

-- cobrApp.timbrados definition

CREATE TABLE `timbrados` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `numero_timbrado` varchar(20) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `estado` enum('BORRADOR','VIGENTE','VENCIDO','ANULADO','INACTIVO') NOT NULL DEFAULT 'BORRADOR',
  `observaciones` text,
  `es_electronico` tinyint(1) NOT NULL DEFAULT '0',
  `facturas_timbrado_legacy_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_timbrado_empresa_numero` (`empresa_id`,`numero_timbrado`),
  KEY `idx_timbrado_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_timbrado_empresa_fechas` (`empresa_id`,`fecha_inicio`,`fecha_fin`),
  KEY `fk_timbrado_created_by` (`created_by`),
  KEY `fk_timbrado_updated_by` (`updated_by`),
  CONSTRAINT `fk_timbrado_created_by` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_timbrado_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_timbrado_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Timbrados fiscales por empresa con historial completo';

-- cobrApp.tipos_descanso definition

CREATE TABLE `tipos_descanso` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `es_obligatorio` tinyint(1) DEFAULT '0',
  `hora_inicio` time DEFAULT NULL,
  `hora_fin_auto` time DEFAULT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_td_empresa` (`empresa_id`),
  CONSTRAINT `fk_td_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.usuario_permisos definition

CREATE TABLE `usuario_permisos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usuario_id` bigint NOT NULL COMMENT 'FK usuarios.id',
  `permiso_id` bigint NOT NULL COMMENT 'FK permisos.id',
  `otorgado` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = permiso otorgado, 0 = permiso denegado',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuario_permiso` (`usuario_id`,`permiso_id`),
  KEY `idx_up_usuario` (`usuario_id`),
  KEY `idx_up_permiso` (`permiso_id`),
  CONSTRAINT `fk_up_permiso` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=209 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Permisos especificos asignados a un usuario (excepciones)';

-- cobrApp.usuarios definition

CREATE TABLE `usuarios` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `rol_id` int NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `cedula` varchar(30) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `debe_cambiar_password` tinyint(1) DEFAULT '0',
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuario_empresa` (`empresa_id`),
  KEY `fk_usuario_rol` (`rol_id`),
  CONSTRAINT `fk_usuario_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- cobrApp.visitas_cobro definition

CREATE TABLE `visitas_cobro` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `asignacion_id` bigint NOT NULL COMMENT 'FK asignaciones.id',
  `cobrador_id` bigint NOT NULL COMMENT 'FK usuarios.id',
  `resultado` enum('cobrado','ausente','reagendado') NOT NULL,
  `monto_cobrado` decimal(12,2) DEFAULT NULL COMMENT 'Solo para resultado=cobrado',
  `medio_pago` varchar(50) DEFAULT NULL COMMENT 'Efectivo, transferencia, etc.',
  `comentario` text,
  `foto_path` varchar(500) DEFAULT NULL COMMENT 'Ruta relativa del archivo de evidencia',
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  `nueva_hora` time DEFAULT NULL COMMENT 'Solo para resultado=reagendado',
  `fecha_hora` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `arqueo_id` bigint DEFAULT NULL,
  `medio_pago_id` int DEFAULT NULL,
  `nro_comprobante` varchar(100) DEFAULT NULL,
  `recibo_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vc_cobrador_fecha` (`cobrador_id`,`fecha_hora`),
  KEY `idx_vc_asignacion` (`asignacion_id`),
  KEY `fk_vc_arqueo` (`arqueo_id`),
  KEY `fk_vc_medio_pago` (`medio_pago_id`),
  KEY `idx_visitas_recibo` (`recibo_id`),
  CONSTRAINT `fk_vc_arqueo` FOREIGN KEY (`arqueo_id`) REFERENCES `arqueos_caja` (`id`),
  CONSTRAINT `fk_vc_asignacion` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vc_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vc_medio_pago` FOREIGN KEY (`medio_pago_id`) REFERENCES `medios_pago` (`id`),
  CONSTRAINT `fk_visita_recibo` FOREIGN KEY (`recibo_id`) REFERENCES `recibos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Historial de visitas realizadas por los cobradores en campo';

-- cobrApp.zonas definition

CREATE TABLE `zonas` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint NOT NULL,
  `cobrador_id` bigint DEFAULT NULL,
  `poligono` json DEFAULT NULL COMMENT 'Array de {lat,lng} definiendo el polígono de la zona',
  `nombre` varchar(100) NOT NULL COMMENT 'Ej: Zona Norte, Barrio San Pedro',
  `descripcion` text,
  `color` varchar(7) DEFAULT '#3B82F6' COMMENT 'Color hex para identificar la zona en el mapa',
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_zonas_empresa` (`empresa_id`),
  KEY `fk_zona_cobrador` (`cobrador_id`),
  CONSTRAINT `fk_zona_cobrador` FOREIGN KEY (`cobrador_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_zonas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Zonas de cobranza para organizar clientes geográficamente';

