const pool = require('../config/db');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Directorio para archivos temporales de duplicados
const TEMP_DIR = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Parsea una fecha desde DD/MM/YYYY, YYYY-MM-DD, o n�mero serial de Excel.
 */
function parseFecha(valor) {
  if (!valor && valor !== 0) return null;
  const str = String(valor).trim();
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000) {
    const d = new Date(1900, 0, 1);
    d.setDate(d.getDate() + num - 2);
    return d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extrae coordenadas de URL de Google Maps o string "lat,lng".
 */
function extraerCoordenadas(valor) {
  if (!valor) return null;
  const str = String(valor).trim();
  const directa = str.match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/);
  if (directa) return { latitud: parseFloat(directa[1]), longitud: parseFloat(directa[2]) };
  const atSign = str.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atSign) return { latitud: parseFloat(atSign[1]), longitud: parseFloat(atSign[2]) };
  const qParam = str.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (qParam) return { latitud: parseFloat(qParam[1]), longitud: parseFloat(qParam[2]) };
  return null;
}

/**
 * Busca el valor de una columna en la fila del Excel con m�ltiples variantes de nombre.
 */
function getCol(fila, ...claves) {
  for (const clave of claves) {
    if (fila[clave] !== undefined && fila[clave] !== '') return String(fila[clave]).trim();
  }
  return '';
}

/**
 * Calcula la fecha de vencimiento de una cuota.
 * Si se provee diaPago, fija ese d�a del mes en cada per�odo.
 */
function calcularFechaVencimiento(fechaBase, numeroCuota, periodicidad, diaPago) {
  const fecha = new Date(fechaBase);

  if (periodicidad === 'MENSUAL') {
    fecha.setMonth(fecha.getMonth() + numeroCuota);
  } else if (periodicidad === 'QUINCENAL') {
    fecha.setDate(fecha.getDate() + 15 * numeroCuota);
  } else {
    // SEMANAL
    fecha.setDate(fecha.getDate() + 7 * numeroCuota);
  }

  if (diaPago && periodicidad === 'MENSUAL') {
    // Ajustar al d�a de pago, sin pasarse del �ltimo d�a del mes
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    fecha.setDate(Math.min(diaPago, ultimoDia));
  }

  return fecha;
}

const ROLES_IMPORTAR = ['ADMIN', 'SUPERVISOR'];

const importarClientes = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcion� ning�n archivo Excel' });
    }

    const usuarioActual = req.user;

    if (!ROLES_IMPORTAR.includes(usuarioActual.rol)) {
      return res.status(403).json({ message: 'No ten�s permisos para importar archivos' });
    }

    let empresa_id = usuarioActual.empresaId;

    if (usuarioActual.rol === 'ADMIN' && req.body.empresa_id) {
      empresa_id = parseInt(req.body.empresa_id, 10);
    }

    if (!empresa_id) {
      return res.status(400).json({ message: 'Se requiere empresa_id' });
    }

    const [[empresa]] = await pool.query(
      'SELECT id, razon_social FROM empresas WHERE id = ? AND estado = 1 LIMIT 1',
      [empresa_id]
    );
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada o inactiva' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const filas = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (filas.length === 0) {
      return res.status(400).json({ message: 'El archivo Excel no contiene datos' });
    }

    const resultado = {
      total: filas.length,
      importados: 0,
      actualizados: 0,
      sinUbicacion: 0,
      creditosCreados: 0,
      errores: [],
      erroresDuplicidad: 0,
      duplicados: [],
      archivoDuplicados: null,
      id_lote: null,
    };

    // ── Crear el lote de importación ──
    // Permite al supervisor eliminar todo lo cargado si se equivocó,
    // siempre que ningún crédito del lote haya sido asignado aún.
    const nombreArchivo = req.file.originalname || 'archivo.xlsx';
    const [loteResult] = await pool.query(
      `INSERT INTO lotes_importacion
         (empresa_id, usuario_id, nombre_archivo, total_filas)
       VALUES (?, ?, ?, ?)`,
      [empresa_id, usuarioActual.id, nombreArchivo, filas.length]
    );
    const idLote = loteResult.insertId;
    resultado.id_lote = idLote;

    // ── Detectar duplicados de numero_credito DENTRO del archivo ──
    // Se agrupan las filas por numero_credito. La primera de cada grupo se
    // procesa normalmente; las siguientes se guardan como duplicadas.
    const filasPorCredito = new Map(); // numero_credito -> índice de la primera fila
    const filasDuplicadas = [];        // lista de filas duplicadas
    const duplicadosPorCredito = new Map(); // numero_credito -> lista de filas duplicadas

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numCredito = getCol(fila, 'numero_credito', 'Numero_Credito', 'nro_credito', 'NUM_CREDITO', 'credito');
      if (numCredito) {
        if (filasPorCredito.has(numCredito)) {
          const dup = { fila: i + 2, numero_credito: numCredito, datos: fila, motivo: 'duplicado_en_archivo' };
          filasDuplicadas.push(dup);
          if (!duplicadosPorCredito.has(numCredito)) {
            duplicadosPorCredito.set(numCredito, []);
          }
          duplicadosPorCredito.get(numCredito).push(dup);
        } else {
          filasPorCredito.set(numCredito, i);
        }
      }
    }

    // Conjunto de números de fila (1-based en Excel) que son duplicados
    const filasDuplicadasSet = new Set(filasDuplicadas.map((d) => d.fila));

    // Filas cuyo numero_credito ya existe en la BD (se detectan durante el loop)
    const filasCreditoExistente = [];

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numFila = i + 2;

      // Saltar filas duplicadas: ya se guardaron en el archivo temporal
      if (filasDuplicadasSet.has(numFila)) {
        continue;
      }

      try {
        const cedula   = getCol(fila, 'cedula', 'Cedula', 'CI', 'ci', 'c�dula', 'C�dula', 'RUC', 'ruc');
        const nombre   = getCol(fila, 'nombre', 'Nombre', 'NOMBRE');
        const apellido = getCol(fila, 'apellido', 'Apellido', 'APELLIDO') || null;
        const telefono = getCol(fila, 'telefono', 'Telefono', 'tel�fono', 'Tel�fono') || null;
        const email    = getCol(fila, 'email', 'Email', 'EMAIL') || null;
        const direccion = getCol(fila, 'direccion', 'Direccion', 'direcci�n', 'Direcci�n') || null;
        const urlMaps  = getCol(fila, 'url_maps', 'url_ubicacion', 'maps', 'Maps', 'URL_Maps');

        if (!cedula) {
          resultado.errores.push({ fila: numFila, error: 'El campo CI/RUC es obligatorio' });
          continue;
        }
        if (!nombre) {
          resultado.errores.push({ fila: numFila, error: 'El campo "nombre" es obligatorio' });
          continue;
        }

        let latitud = null;
        let longitud = null;
        const latRaw = getCol(fila, 'latitud', 'Latitud', 'lat', 'Lat');
        const lngRaw = getCol(fila, 'longitud', 'Longitud', 'lng', 'Lng', 'lon', 'Lon');

        if (latRaw && lngRaw && !isNaN(parseFloat(latRaw)) && !isNaN(parseFloat(lngRaw))) {
          latitud  = parseFloat(latRaw);
          longitud = parseFloat(lngRaw);
        } else if (urlMaps) {
          const coords = extraerCoordenadas(urlMaps);
          if (coords) { latitud = coords.latitud; longitud = coords.longitud; }
        }

        if (latitud === null) resultado.sinUbicacion++;

       
        let clienteId;
        const [[clienteExistente]] = await pool.query(
          'SELECT id FROM clientes WHERE cedula = ? LIMIT 1',
          [cedula]
        );

        if (clienteExistente) {
          clienteId = clienteExistente.id;
        } else {
          const [ins] = await pool.query(
            'INSERT INTO clientes (cedula, nombre, apellido, telefono, email) VALUES (?, ?, ?, ?, ?)',
            [cedula, nombre, apellido, telefono, email]
          );
          clienteId = ins.insertId;
        }

      
        const [[relExistente]] = await pool.query(
          'SELECT id FROM clientes_empresas WHERE cliente_id = ? AND empresa_id = ? LIMIT 1',
          [clienteId, empresa_id]
        );

        if (relExistente) {
          //
          if (latitud !== null) {
            await pool.query(
              'UPDATE clientes_empresas SET direccion = COALESCE(?, direccion), latitud = ?, longitud = ?, id_lote = ? WHERE id = ?',
              [direccion, latitud, longitud, idLote, relExistente.id]
            );
          }
          resultado.actualizados++;
        } else {
          await pool.query(
            'INSERT INTO clientes_empresas (cliente_id, empresa_id, direccion, latitud, longitud, id_lote) VALUES (?, ?, ?, ?, ?, ?)',
            [clienteId, empresa_id, direccion, latitud, longitud, idLote]
          );
          resultado.importados++;
        }

        // â”€â”€ Datos del cr�dito (opcionales) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const numCredito       = getCol(fila, 'numero_credito', 'Numero_Credito', 'nro_credito', 'NUM_CREDITO', 'credito') || null;
        const descripcionRaw   = getCol(fila, 'descripcion', 'Descripcion', 'producto', 'Producto', 'PRODUCTO') || null;
        const montoTotalRaw    = getCol(fila, 'monto_total', 'Monto_Total', 'total_financiado', 'Total_Financiado', 'monto', 'Monto');
        const cantCuotasRaw    = getCol(fila, 'cantidad_cuotas', 'Cantidad_Cuotas', 'cuotas', 'Cuotas', 'nro_cuotas');
        const cuotasPagadasRaw = getCol(fila, 'cuotas_pagadas', 'Cuotas_Pagadas', 'pagadas') || '0';
        const montoCuotaRaw    = getCol(fila, 'monto_cuota', 'Monto_Cuota', 'valor_cuota');
        const diaPagoRaw       = getCol(fila, 'dia_pago', 'Dia_Pago', 'dia');
        const precioContadoRaw = getCol(fila, 'precio_contado', 'Precio_Contado', 'precio');
        const entregaRaw       = getCol(fila, 'entrega_inicial', 'Entrega_Inicial', 'entrega', 'enganche');
        const periodicidadRaw  = getCol(fila, 'periodicidad', 'Periodicidad') || 'MENSUAL';
        const tasaInteresRaw   = getCol(fila, 'tasa_interes', 'Tasa_Interes', 'tasa') || '0';
        const fechaOtorgRaw    = getCol(fila, 'fecha_otorgamiento', 'Fecha_Otorgamiento', 'fecha_inicio', 'Fecha', 'fecha');

        const hayDatosCredito = montoTotalRaw || cantCuotasRaw || numCredito;
        if (!hayDatosCredito) continue;

        if (!montoTotalRaw || !cantCuotasRaw) {
          resultado.errores.push({
            fila: numFila,
            error: 'Cr�dito con datos incompletos: se requieren monto_total y cantidad_cuotas',
          });
          continue;
        }

        const monto  = parseFloat(String(montoTotalRaw).replace(/\./g, '').replace(',', '.'));
        const cuotas = parseInt(cantCuotasRaw, 10);
        const cuotasPagadas = Math.max(0, parseInt(cuotasPagadasRaw, 10) || 0);

        if (isNaN(monto) || monto <= 0) {
          resultado.errores.push({ fila: numFila, error: `monto_total inv�lido: "${montoTotalRaw}"` });
          continue;
        }
        if (isNaN(cuotas) || cuotas <= 0 || cuotas > 1000) {
          resultado.errores.push({ fila: numFila, error: `cantidad_cuotas inv�lida: "${cantCuotasRaw}"` });
          continue;
        }
        if (cuotasPagadas > cuotas) {
          resultado.errores.push({ fila: numFila, error: `cuotas_pagadas (${cuotasPagadas}) no puede superar cantidad_cuotas (${cuotas})` });
          continue;
        }

        if (numCredito) {
          const [[credExistente]] = await pool.query(
            'SELECT id FROM creditos WHERE numero_credito = ? AND empresa_id = ? LIMIT 1',
            [numCredito, empresa_id]
          );
          if (credExistente) {
            // Guardar la fila en el archivo temporal de duplicados con motivo "ya registrado en BD"
            filasCreditoExistente.push({
              fila: numFila,
              numero_credito: numCredito,
              datos: fila,
              motivo: 'ya_registrado_en_bd',
            });
            resultado.erroresDuplicidad++;
            resultado.errores.push({ fila: numFila, error: `N�mero de cr�dito ya registrado: ${numCredito}` });
            continue;
          }
        }

        const PERIODICIDADES = ['SEMANAL', 'QUINCENAL', 'MENSUAL'];
        const periodicidad = PERIODICIDADES.includes(periodicidadRaw.toUpperCase())
          ? periodicidadRaw.toUpperCase() : 'MENSUAL';

        const tasa          = Math.max(0, parseFloat(tasaInteresRaw) || 0);
        const precioContado = precioContadoRaw ? parseFloat(String(precioContadoRaw).replace(/\./g, '').replace(',', '.')) || null : null;
        const entrega       = entregaRaw ? parseFloat(String(entregaRaw).replace(/\./g, '').replace(',', '.')) || 0 : 0;
        const diaPago       = diaPagoRaw ? parseInt(diaPagoRaw, 10) || null : null;
        const fechaOtorg    = parseFecha(fechaOtorgRaw) || new Date();
        const fechaOtorgStr = fechaOtorg.toISOString().split('T')[0];

        // monto_cuota: usar el del Excel o calcular
        const montoCuotaCalculado = parseFloat((monto / cuotas).toFixed(2));
        const montoCuotaFinal = montoCuotaRaw
          ? parseFloat(String(montoCuotaRaw).replace(/\./g, '').replace(',', '.')) || montoCuotaCalculado
          : montoCuotaCalculado;

        // saldo_actual = monto total menos lo ya pagado
        const saldoActual = parseFloat((monto - montoCuotaFinal * cuotasPagadas).toFixed(2));

        const [credResult] = await pool.query(
          `INSERT INTO creditos
             (empresa_id, cliente_id, numero_credito, descripcion, precio_contado, entrega_inicial,
              monto_total, saldo_actual, cantidad_cuotas, cuotas_pagadas, monto_cuota,
              dia_pago, tasa_interes, periodicidad, fecha_otorgamiento, estado, id_lote)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)`,
          [empresa_id, clienteId, numCredito, descripcionRaw, precioContado, entrega,
           monto, saldoActual, cuotas, cuotasPagadas, montoCuotaFinal,
           diaPago, tasa, periodicidad, fechaOtorgStr, idLote]
        );
        const creditoId = credResult.insertId;

        for (let c = 1; c <= cuotas; c++) {
          const fechaVenc = calcularFechaVencimiento(fechaOtorg, c, periodicidad, diaPago);
          const montoEsta = c === cuotas
            ? parseFloat((monto - montoCuotaFinal * (cuotas - 1)).toFixed(2))
            : montoCuotaFinal;
          const estadoCuota = c <= cuotasPagadas ? 'PAGADO' : 'PENDIENTE';
          const fechaPago   = c <= cuotasPagadas ? fechaOtorgStr : null;

          await pool.query(
            `INSERT INTO cuotas (credito_id, numero_cuota, fecha_vencimiento, monto_cuota, saldo_cuota, estado, fecha_pago)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [creditoId, c, fechaVenc.toISOString().split('T')[0],
             montoEsta, c <= cuotasPagadas ? 0 : montoEsta,
             estadoCuota, fechaPago]
          );
        }

        resultado.creditosCreados++;

        // ── Si este crédito tiene filas duplicadas en el archivo, verificar
        //    si alguna tiene más datos y actualizar el crédito del primero ──
        if (numCredito && duplicadosPorCredito.has(numCredito)) {
          const dups = duplicadosPorCredito.get(numCredito);
          for (const dup of dups) {
            const d = dup.datos;
            const campos = [];

            // Comparar cada campo: si el duplicado tiene valor y el primero no, usar el del duplicado
            const dDescripcion = getCol(d, 'descripcion', 'Descripcion', 'producto', 'Producto', 'PRODUCTO');
            if (dDescripcion && !descripcionRaw) campos.push(`descripcion = '${dDescripcion.replace(/'/g, "''")}'`);

            const dMonto = getCol(d, 'monto_total', 'Monto_Total', 'total_financiado', 'Total_Financiado', 'monto', 'Monto');
            if (dMonto && !montoTotalRaw) {
              const m = parseFloat(String(dMonto).replace(/\./g, '').replace(',', '.'));
              if (!isNaN(m) && m > 0) campos.push(`monto_total = ${m}`);
            }

            const dCuotas = getCol(d, 'cantidad_cuotas', 'Cantidad_Cuotas', 'cuotas', 'Cuotas', 'nro_cuotas');
            if (dCuotas && !cantCuotasRaw) {
              const c = parseInt(dCuotas, 10);
              if (!isNaN(c) && c > 0 && c <= 1000) campos.push(`cantidad_cuotas = ${c}`);
            }

            const dCuotasPagadas = getCol(d, 'cuotas_pagadas', 'Cuotas_Pagadas', 'pagadas');
            if (dCuotasPagadas && !cuotasPagadasRaw) {
              const cp = Math.max(0, parseInt(dCuotasPagadas, 10) || 0);
              campos.push(`cuotas_pagadas = ${cp}`);
            }

            const dMontoCuota = getCol(d, 'monto_cuota', 'Monto_Cuota', 'valor_cuota');
            if (dMontoCuota && !montoCuotaRaw) {
              const mc = parseFloat(String(dMontoCuota).replace(/\./g, '').replace(',', '.'));
              if (!isNaN(mc) && mc > 0) campos.push(`monto_cuota = ${mc}`);
            }

            const dDiaPago = getCol(d, 'dia_pago', 'Dia_Pago', 'dia');
            if (dDiaPago && !diaPagoRaw) {
              const dp = parseInt(dDiaPago, 10);
              if (!isNaN(dp) && dp > 0 && dp <= 31) campos.push(`dia_pago = ${dp}`);
            }

            const dPrecioContado = getCol(d, 'precio_contado', 'Precio_Contado', 'precio');
            if (dPrecioContado && !precioContadoRaw) {
              const pc = parseFloat(String(dPrecioContado).replace(/\./g, '').replace(',', '.'));
              if (!isNaN(pc) && pc > 0) campos.push(`precio_contado = ${pc}`);
            }

            const dEntrega = getCol(d, 'entrega_inicial', 'Entrega_Inicial', 'entrega', 'enganche');
            if (dEntrega && !entregaRaw) {
              const en = parseFloat(String(dEntrega).replace(/\./g, '').replace(',', '.'));
              if (!isNaN(en) && en >= 0) campos.push(`entrega_inicial = ${en}`);
            }

            const dPeriodicidad = getCol(d, 'periodicidad', 'Periodicidad');
            if (dPeriodicidad && !periodicidadRaw) {
              const per = dPeriodicidad.toUpperCase();
              if (['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(per)) campos.push(`periodicidad = '${per}'`);
            }

            const dTasa = getCol(d, 'tasa_interes', 'Tasa_Interes', 'tasa');
            if (dTasa && !tasaInteresRaw) {
              const t = Math.max(0, parseFloat(dTasa) || 0);
              campos.push(`tasa_interes = ${t}`);
            }

            const dFecha = getCol(d, 'fecha_otorgamiento', 'Fecha_Otorgamiento', 'fecha_inicio', 'Fecha', 'fecha');
            if (dFecha && !fechaOtorgRaw) {
              const f = parseFecha(dFecha);
              if (f) campos.push(`fecha_otorgamiento = '${f.toISOString().split('T')[0]}'`);
            }

            if (campos.length > 0) {
              await pool.query(
                `UPDATE creditos SET ${campos.join(', ')} WHERE id = ?`,
                [creditoId]
              );
            }
          }
        }
      } catch (rowErr) {
        resultado.errores.push({ fila: numFila, error: rowErr.message });
      }
    }

    // ── Crear/actualizar el archivo temporal con duplicados y créditos ya registrados en BD ──
    const filasConError = [...filasDuplicadas, ...filasCreditoExistente];
    if (filasConError.length > 0) {
      const filasParaExcel = filasConError.map((d) => ({
        fila_original: d.fila,
        numero_credito: d.numero_credito,
        motivo: d.motivo === 'ya_registrado_en_bd' ? 'Ya registrado en BD' : 'Duplicado en archivo',
        ...d.datos,
      }));
      const wbDup = xlsx.utils.book_new();
      const wsDup = xlsx.utils.json_to_sheet(filasParaExcel);
      xlsx.utils.book_append_sheet(wbDup, wsDup, 'Duplicados');
      const bufferDup = xlsx.write(wbDup, { type: 'buffer', bookType: 'xlsx' });

      const nombreArchivo = `duplicados_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.xlsx`;
      const rutaArchivo = path.join(TEMP_DIR, nombreArchivo);
      fs.writeFileSync(rutaArchivo, bufferDup);

      resultado.archivoDuplicados = nombreArchivo;
      resultado.duplicados = filasConError.map((d) => ({
        fila: d.fila,
        numero_credito: d.numero_credito,
        motivo: d.motivo,
      }));
    }

    // ── Actualizar el lote con los contadores finales ──
    await pool.query(
      `UPDATE lotes_importacion
         SET clientes_nuevos = ?, clientes_actualizados = ?, creditos_creados = ?, errores = ?
       WHERE id = ?`,
      [resultado.importados, resultado.actualizados, resultado.creditosCreados,
       resultado.errores.length, idLote]
    );

    const msg = `${resultado.importados} cliente(s) nuevos, ${resultado.actualizados} actualizados` +
      (resultado.creditosCreados > 0 ? `, ${resultado.creditosCreados} cr�dito(s) creados` : '');
    return res.status(200).json({ message: msg, data: resultado });
  } catch (error) {
    return next(error);
  }
};

const getClientesSinUbicacion = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    const params = [];

    let query = `
      SELECT c.id, c.nombre, c.apellido, c.cedula, c.telefono, c.email,
             ce.direccion, e.razon_social AS empresa
      FROM clientes c
      INNER JOIN clientes_empresas ce ON ce.cliente_id = c.id
      INNER JOIN empresas e ON e.id = ce.empresa_id
      WHERE (ce.latitud IS NULL OR ce.longitud IS NULL)
        AND ce.estado = 1`;

    if (usuarioActual.rol !== 'ADMIN') {
      query += ' AND ce.empresa_id = ?';
      params.push(usuarioActual.empresaId);
    }

    query += ' ORDER BY c.id DESC LIMIT 500';

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

const updateUbicacionCliente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, url_maps } = req.body;
    const usuarioActual = req.user;

    let lat = latitud !== undefined && latitud !== '' ? parseFloat(latitud) : null;
    let lng = longitud !== undefined && longitud !== '' ? parseFloat(longitud) : null;

    if (url_maps && (!lat || !lng)) {
      const coords = extraerCoordenadas(url_maps);
      if (!coords) {
        return res.status(400).json({
          message: 'No se pudieron extraer coordenadas. Us� el link completo de Google Maps, no el link corto (goo.gl).',
        });
      }
      lat = coords.latitud;
      lng = coords.longitud;
    }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: 'Se requiere latitud/longitud v�lida o una URL de Google Maps' });
    }

    // ADMIN puede actualizar cualquier empresa; otros solo la suya
    let whereExtra = '';
    const params = [lat, lng, id];
    if (usuarioActual.rol !== 'ADMIN') {
      whereExtra = ' AND ce.empresa_id = ?';
      params.push(usuarioActual.empresaId);
    }

    const [result] = await pool.query(
      `UPDATE clientes_empresas ce SET ce.latitud = ?, ce.longitud = ? WHERE ce.cliente_id = ?${whereExtra}`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado en esta empresa' });
    }

    return res.json({ message: 'Ubicaci�n actualizada correctamente', data: { latitud: lat, longitud: lng } });
  } catch (error) {
    return next(error);
  }
};

const descargarPlantilla = (req, res) => {
  const wb = xlsx.utils.book_new();

  const datos = [
    {
      cedula: '1234567',
      nombre: 'Juan',
      apellido: 'P�rez',
      telefono: '0981123456',
      email: 'juan@ejemplo.com',
      direccion: 'Calle Principal 123',
      url_maps: 'https://maps.google.com/?q=-25.2867,-57.6478',
      latitud: '',
      longitud: '',
      numero_credito: 'CRED-001',
      descripcion: 'Tele Samsung 55"',
      precio_contado: 1800000,
      entrega_inicial: 500000,
      monto_total: 2500000,
      cantidad_cuotas: 10,
      cuotas_pagadas: 2,
      monto_cuota: 250000,
      dia_pago: 10,
      periodicidad: 'MENSUAL',
      tasa_interes: 5.5,
      fecha_otorgamiento: '01/05/2026',
    },
    {
      cedula: '7654321',
      nombre: 'Mar�a',
      apellido: 'Gonz�lez',
      telefono: '0991456789',
      email: '',
      direccion: 'Barrio San Pedro',
      url_maps: '',
      latitud: '-25.2950',
      longitud: '-57.6200',
      numero_credito: 'CRED-002',
      descripcion: 'Heladera No Frost',
      precio_contado: 900000,
      entrega_inicial: 0,
      monto_total: 1000000,
      cantidad_cuotas: 6,
      cuotas_pagadas: 0,
      monto_cuota: '',
      dia_pago: 15,
      periodicidad: 'QUINCENAL',
      tasa_interes: 0,
      fecha_otorgamiento: '15/04/2026',
    },
  ];

  const ws = xlsx.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 12 }, // cedula
    { wch: 15 }, // nombre
    { wch: 15 }, // apellido
    { wch: 15 }, // telefono
    { wch: 28 }, // email
    { wch: 30 }, // direccion
    { wch: 60 }, // url_maps
    { wch: 12 }, // latitud
    { wch: 12 }, // longitud
    { wch: 16 }, // numero_credito
    { wch: 25 }, // descripcion
    { wch: 16 }, // precio_contado
    { wch: 16 }, // entrega_inicial
    { wch: 16 }, // monto_total
    { wch: 14 }, // cantidad_cuotas
    { wch: 14 }, // cuotas_pagadas
    { wch: 14 }, // monto_cuota
    { wch: 10 }, // dia_pago
    { wch: 14 }, // periodicidad
    { wch: 12 }, // tasa_interes
    { wch: 20 }, // fecha_otorgamiento
  ];

  xlsx.utils.book_append_sheet(wb, ws, 'Clientes');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_clientes_cobrapp.xlsx"');
  return res.send(buffer);
};

// ─────────────────────────────────────────────────────────────
// GET /api/clientes/importar/duplicados/:archivo
// Descarga el archivo temporal de duplicados y lo elimina después.
// ─────────────────────────────────────────────────────────────
const descargarDuplicados = (req, res) => {
  try {
    const { archivo } = req.params;

    // Validar que el nombre no intente escapar del directorio temporal
    if (!archivo || !/^duplicados_[a-zA-Z0-9_]+\.xlsx$/.test(archivo)) {
      return res.status(400).json({ message: 'Nombre de archivo inválido' });
    }

    const rutaArchivo = path.join(TEMP_DIR, archivo);

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ message: 'El archivo de duplicados ya no existe o fue descargado' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);

    // Enviar el archivo y eliminarlo al terminar
    const stream = fs.createReadStream(rutaArchivo);
    stream.on('end', () => {
      fs.unlink(rutaArchivo, () => {});
    });
    stream.on('error', () => {
      fs.unlink(rutaArchivo, () => {});
    });
    return stream.pipe(res);
  } catch (error) {
    return res.status(500).json({ message: 'Error al descargar el archivo de duplicados' });
  }
};

//                                                              
// POST /api/clientes
// Crear cliente manualmente (global + relaci�n con empresa)
//                                                              
const crearCliente = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    const { cedula, nombre, apellido, telefono, email, direccion } = req.body;

    let empresa_id = usuarioActual.empresaId;
    if (usuarioActual.rol === 'ADMIN' && req.body.empresa_id) {
      empresa_id = parseInt(req.body.empresa_id, 10);
    }

    if (!empresa_id) {
      return res.status(400).json({ message: 'Se requiere empresa_id' });
    }
    if (!cedula || !String(cedula).trim()) {
      return res.status(400).json({ message: 'El campo CI/RUC es obligatorio' });
    }
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ message: 'El campo nombre es obligatorio' });
    }

    const cedulaStr = String(cedula).trim();
    const nombreStr = String(nombre).trim();

    // Buscar o crear cliente global por CI
    let clienteId;
    const [[clienteExistente]] = await pool.query(
      'SELECT id FROM clientes WHERE cedula = ? LIMIT 1',
      [cedulaStr]
    );

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const [ins] = await pool.query(
        'INSERT INTO clientes (cedula, nombre, apellido, telefono, email) VALUES (?, ?, ?, ?, ?)',
        [cedulaStr, nombreStr, apellido || null, telefono || null, email || null]
      );
      clienteId = ins.insertId;
    }

    // Verificar si ya existe la relaci�n con esta empresa
    const [[relExistente]] = await pool.query(
      'SELECT id FROM clientes_empresas WHERE cliente_id = ? AND empresa_id = ? LIMIT 1',
      [clienteId, empresa_id]
    );

    if (relExistente) {
      return res.status(409).json({ message: 'El cliente ya est� registrado en esta empresa' });
    }

    await pool.query(
      'INSERT INTO clientes_empresas (cliente_id, empresa_id, direccion) VALUES (?, ?, ?)',
      [clienteId, empresa_id, direccion || null]
    );

    return res.status(201).json({ message: 'Cliente creado correctamente', data: { id: clienteId } });
  } catch (error) {
    return next(error);
  }
};

const updateCliente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, cedula, telefono, email, direccion } = req.body;
    const usuarioActual = req.user;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    // Verificar que el cliente pertenece a la empresa del usuario
    const extraWhere = usuarioActual.rol !== 'ADMIN' ? ' AND ce.empresa_id = ?' : '';
    const extraParams = usuarioActual.rol !== 'ADMIN' ? [usuarioActual.empresaId] : [];

    const [[existe]] = await pool.query(
      `SELECT c.id FROM clientes c
       INNER JOIN clientes_empresas ce ON ce.cliente_id = c.id
       WHERE c.id = ?${extraWhere} LIMIT 1`,
      [id, ...extraParams]
    );

    if (!existe) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    await pool.query(
      'UPDATE clientes SET nombre = ?, apellido = ?, cedula = ?, telefono = ?, email = ? WHERE id = ?',
      [nombre.trim(), apellido?.trim() || null, cedula?.trim() || null,
       telefono?.trim() || null, email?.trim() || null, id]
    );

    if (direccion !== undefined) {
      const ceParams = [direccion?.trim() || null, id];
      let ceWhere = 'WHERE cliente_id = ?';
      if (usuarioActual.rol !== 'ADMIN') {
        ceWhere += ' AND empresa_id = ?';
        ceParams.push(usuarioActual.empresaId);
      }
      await pool.query(`UPDATE clientes_empresas SET direccion = ? ${ceWhere}`, ceParams);
    }

    return res.json({ message: 'Cliente actualizado correctamente' });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/clientes/lotes-importacion
// Lista los lotes de importación. ADMIN ve todos, los demás solo
// los de su empresa. Incluye cuántos créditos tiene cada lote y
// cuántos ya fueron asignados a un cobrador.
// ─────────────────────────────────────────────────────────────
const getLotes = async (req, res, next) => {
  try {
    const usuarioActual = req.user;
    const params = [];

    let query = `
      SELECT
        l.id,
        l.empresa_id,
        l.usuario_id,
        l.nombre_archivo,
        l.total_filas,
        l.clientes_nuevos,
        l.clientes_actualizados,
        l.creditos_creados,
        l.errores,
        l.fecha_importacion,
        l.estado,
        u.nombre AS usuario_nombre,
        u.apellido AS usuario_apellido,
        e.razon_social AS empresa_nombre,
        (SELECT COUNT(*) FROM creditos cr WHERE cr.id_lote = l.id) AS creditos_count,
        (SELECT COUNT(*)
           FROM creditos cr
           INNER JOIN cuotas q ON q.credito_id = cr.id
           INNER JOIN asignaciones a ON a.cuota_id = q.id
           WHERE cr.id_lote = l.id) AS asignados_count
      FROM lotes_importacion l
      INNER JOIN usuarios u ON u.id = l.usuario_id
      INNER JOIN empresas e ON e.id = l.empresa_id
      WHERE l.estado = 'ACTIVO'`;

    if (usuarioActual.rol !== 'ADMIN') {
      query += ' AND l.empresa_id = ?';
      params.push(usuarioActual.empresaId);
    }

    query += ' ORDER BY l.fecha_importacion DESC';

    const [rows] = await pool.query(query, params);
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/clientes/lotes-importacion/:id
// Elimina un lote de importación (créditos, cuotas y clientes
// huérfanos creados por ese lote). Solo si ningún crédito del
// lote fue asignado a un cobrador ni tiene recibos/facturas.
// ─────────────────────────────────────────────────────────────
const eliminarLote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioActual = req.user;

    // Verificar que el lote existe y pertenece a la empresa del usuario
    const params = [id];
    let query = `
      SELECT l.id, l.empresa_id, l.estado
      FROM lotes_importacion l
      WHERE l.id = ? AND l.estado = 'ACTIVO'`;

    if (usuarioActual.rol !== 'ADMIN') {
      query += ' AND l.empresa_id = ?';
      params.push(usuarioActual.empresaId);
    }

    const [[lote]] = await pool.query(query, params);
    if (!lote) {
      return res.status(404).json({ message: 'Lote no encontrado o ya eliminado' });
    }

    // Obtener los créditos del lote
    const [creditos] = await pool.query(
      'SELECT id FROM creditos WHERE id_lote = ?',
      [id]
    );

    if (creditos.length > 0) {
      const creditoIds = creditos.map((c) => c.id);
      const placeholders = creditoIds.map(() => '?').join(',');

      // Verificar si algún crédito del lote fue asignado a un cobrador
      const [[asignado]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM cuotas q
         INNER JOIN asignaciones a ON a.cuota_id = q.id
         WHERE q.credito_id IN (${placeholders})`,
        creditoIds
      );

      if (asignado.total > 0) {
        return res.status(409).json({
          message: 'No se puede eliminar el lote porque algunos créditos ya fueron asignados a cobradores.',
        });
      }

      // Verificar si algún crédito/cuota del lote tiene recibos o facturas
      const [[conRecibos]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM recibo_detalles rd
         WHERE rd.credito_id IN (${placeholders})`,
        creditoIds
      );

      const [[conFacturas]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM facturas f
         INNER JOIN cuotas q ON q.id = f.cuota_id
         WHERE q.credito_id IN (${placeholders})`,
        creditoIds
      );

      if (conRecibos.total > 0 || conFacturas.total > 0) {
        return res.status(409).json({
          message: 'No se puede eliminar el lote porque algunos créditos ya tienen recibos o facturas generados.',
        });
      }

      // Eliminar cuotas de los créditos del lote
      await pool.query(
        `DELETE FROM cuotas WHERE credito_id IN (${placeholders})`,
        creditoIds
      );

      // Eliminar los créditos del lote
      await pool.query(
        `DELETE FROM creditos WHERE id IN (${placeholders})`,
        creditoIds
      );
    }

    // Limpiar clientes huérfanos: clientes que fueron creados por este lote
    // (clientes_empresas.id_lote = este lote) y que ya no tienen ninguna
    // relación con ninguna empresa.
    const [clientesHuérfanos] = await pool.query(
      `SELECT ce.cliente_id
       FROM clientes_empresas ce
       WHERE ce.id_lote = ?
         AND NOT EXISTS (
           SELECT 1 FROM clientes_empresas ce2
           WHERE ce2.cliente_id = ce.cliente_id
             AND ce2.id_lote IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM clientes_empresas ce3
           WHERE ce3.cliente_id = ce.cliente_id
             AND ce3.id_lote <> ?
         )`,
      [id, id]
    );

    if (clientesHuérfanos.length > 0) {
      const clienteIds = clientesHuérfanos.map((c) => c.cliente_id);
      const placeholdersCli = clienteIds.map(() => '?').join(',');

      // Eliminar las relaciones cliente-empresa de este lote
      await pool.query(
        `DELETE FROM clientes_empresas WHERE id_lote = ?`,
        [id]
      );

      // Eliminar los clientes huérfanos (no tienen más relaciones)
      await pool.query(
        `DELETE FROM clientes WHERE id IN (${placeholdersCli})`,
        clienteIds
      );
    } else {
      // Solo eliminar las relaciones cliente-empresa de este lote
      await pool.query(
        `DELETE FROM clientes_empresas WHERE id_lote = ?`,
        [id]
      );
    }

    // Marcar el lote como eliminado
    await pool.query(
      `UPDATE lotes_importacion SET estado = 'ELIMINADO' WHERE id = ?`,
      [id]
    );

    return res.json({
      message: `Lote eliminado correctamente (${creditos.length} crédito(s) eliminados).`,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  crearCliente,
  updateCliente,
  importarClientes,
  getClientesSinUbicacion,
  updateUbicacionCliente,
  descargarPlantilla,
  descargarDuplicados,
  getLotes,
  eliminarLote,
};
