const pool = require('../config/db');
const xlsx = require('xlsx');

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
    };

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numFila = i + 2;

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
              'UPDATE clientes_empresas SET direccion = COALESCE(?, direccion), latitud = ?, longitud = ? WHERE id = ?',
              [direccion, latitud, longitud, relExistente.id]
            );
          }
          resultado.actualizados++;
        } else {
          await pool.query(
            'INSERT INTO clientes_empresas (cliente_id, empresa_id, direccion, latitud, longitud) VALUES (?, ?, ?, ?, ?)',
            [clienteId, empresa_id, direccion, latitud, longitud]
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
              dia_pago, tasa_interes, periodicidad, fecha_otorgamiento, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')`,
          [empresa_id, clienteId, numCredito, descripcionRaw, precioContado, entrega,
           monto, saldoActual, cuotas, cuotasPagadas, montoCuotaFinal,
           diaPago, tasa, periodicidad, fechaOtorgStr]
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
      } catch (rowErr) {
        resultado.errores.push({ fila: numFila, error: rowErr.message });
      }
    }

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

module.exports = {
  crearCliente,
  updateCliente,
  importarClientes,
  getClientesSinUbicacion,
  updateUbicacionCliente,
  descargarPlantilla,
};
