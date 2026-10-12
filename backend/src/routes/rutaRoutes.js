const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// URL del servicio de enrutamiento. Por defecto usa el servidor público de
// OSRM. Si más adelante levantas un OSRM propio (p. ej. en la misma máquina
// con Docker), solo cambia esta variable en el .env:
//   OSRM_URL=http://localhost:5001
const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';

// El servidor público de OSRM admite hasta 100 coordenadas por petición y es
// sensible a rutas muy largas. Dividimos en segmentos de a lo más 25 puntos.
const MAX_PUNTOS_POR_SEGMENTO = 25;
const PASO = MAX_PUNTOS_POR_SEGMENTO - 1; // los segmentos se superponen en 1 punto

// ── Caché simple en memoria (evita repetir la misma ruta) ──────────────────
const cache = new Map();
const CACHE_MAX = 200;

function claveSegmento(coords) {
  return coords.map((c) => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`).join('|');
}

async function obtenerRutaSegmento(coords) {
  const key = claveSegmento(coords);
  if (cache.has(key)) return cache.get(key);

  const coordStr = coords.map((c) => `${c.longitude},${c.latitude}`).join(';');
  const url = `${OSRM_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OSRM respondió con estado ${res.status}`);
  const data = await res.json();
  if (!data.routes?.[0]?.geometry?.coordinates) {
    throw new Error('OSRM no devolvió geometría para este tramo');
  }

  const route = data.routes[0];
  const resultado = {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    })),
    distance: route.distance || 0,
    duration: route.duration || 0,
  };

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, resultado);
  return resultado;
}

/**
 * POST /api/ruta
 * Body: { coordinates: [{ latitude, longitude }, ...] }  (en el orden de visita)
 * Devuelve la geometría de la ruta real por calles entre esos puntos.
 */
router.post('/ruta', authenticateToken, async (req, res) => {
  try {
    const { coordinates } = req.body || {};
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ message: 'Se requieren al menos 2 coordenadas' });
    }

    const puntos = coordinates.map((c) => ({
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
    }));
    if (puntos.some((p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))) {
      return res.status(400).json({ message: 'Coordenadas inválidas' });
    }

    // Divide en segmentos consecutivos (superpuestos) para no exceder el límite
    const segmentos = [];
    for (let i = 0; i < puntos.length - 1; i += PASO) {
      segmentos.push(puntos.slice(i, i + MAX_PUNTOS_POR_SEGMENTO));
    }

    const resultados = [];
    for (const segmento of segmentos) {
      resultados.push(await obtenerRutaSegmento(segmento));
    }

    // Une las geometrías evitando duplicar el punto de unión entre segmentos
    const coordsFinales = [];
    let distanciaTotal = 0;
    let duracionTotal = 0;
    resultados.forEach((r, idx) => {
      const inicio = idx === 0 ? 0 : 1;
      coordsFinales.push(...r.coordinates.slice(inicio));
      distanciaTotal += r.distance;
      duracionTotal += r.duration;
    });

    res.json({
      coordinates: coordsFinales,
      distance: distanciaTotal,
      duration: duracionTotal,
    });
  } catch (error) {
    console.error('Error calculando ruta por calles:', error.message);
    res.status(502).json({
      message: 'No se pudo calcular la ruta por calles',
      detail: error.message,
    });
  }
});

module.exports = router;
