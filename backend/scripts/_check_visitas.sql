SELECT COUNT(*) AS total_recibos FROM recibos;
SELECT id, numero_recibo, total_recibo, estado, fecha_emision, cobrador_id, cliente_id, visita_cobro_id FROM recibos ORDER BY id;
SELECT COUNT(*) AS total_visitas_con_recibo FROM visitas_cobro WHERE recibo_id IS NOT NULL;
SELECT id, cobrador_asignado_id FROM cajas;
SELECT id, cobrador_id, estado, saldo_actual FROM caja_aperturas;
SELECT id, tipo_documento, serie, ultimo_numero_asignado FROM numeradores;








