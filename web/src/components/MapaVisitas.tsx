"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Gestion } from "@/services/api";

// ── Ícono circular por color ──────────────────────────────────
function circlIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 5px rgba(0,0,0,.5);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const ICONO: Record<string, L.DivIcon> = {
  cobrado:    circlIcon("#10b981"),
  ausente:    circlIcon("#ef4444"),
  reagendado: circlIcon("#f59e0b"),
};

const LABEL: Record<string, string> = {
  cobrado:    "Cobrado",
  ausente:    "Ausente",
  reagendado: "Reagendado",
};

const COLOR_TEXT: Record<string, string> = {
  cobrado:    "#065f46",
  ausente:    "#991b1b",
  reagendado: "#92400e",
};

interface Props {
  gestiones: Gestion[];
}

// Centro por defecto: Asunción, Paraguay
const DEFAULT_CENTER: [number, number] = [-25.2867, -57.647];

export default function MapaVisitas({ gestiones }: Props) {
  const conCoords = gestiones.filter(
    (g) => g.latitud != null && g.longitud != null
  );

  // Calcular bounds si hay puntos
  let center: [number, number] = DEFAULT_CENTER;
  let zoom = 12;
  if (conCoords.length > 0) {
    const lats = conCoords.map((g) => g.latitud as number);
    const lngs = conCoords.map((g) => g.longitud as number);
    center = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
    zoom = conCoords.length === 1 ? 15 : 13;
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {conCoords.map((g) => (
        <Marker
          key={g.id}
          position={[g.latitud as number, g.longitud as number]}
          icon={ICONO[g.resultado] ?? circlIcon("#6366f1")}
        >
          <Popup maxWidth={220}>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {g.cliente_nombre} {g.cliente_apellido ?? ""}
              </div>

              <div style={{
                display: "inline-block",
                background: g.resultado === "cobrado" ? "#d1fae5"
                          : g.resultado === "ausente"  ? "#fee2e2"
                          : "#fef3c7",
                color: COLOR_TEXT[g.resultado],
                padding: "1px 7px",
                borderRadius: 9999,
                fontWeight: 600,
                marginBottom: 6,
              }}>
                {LABEL[g.resultado]}
              </div>

              {g.monto_cobrado && (
                <div>
                  <b>Monto:</b> Gs.{" "}
                  {Number(g.monto_cobrado).toLocaleString("es-PY")}
                  {g.medio_pago && ` (${g.medio_pago})`}
                </div>
              )}
              <div>
                <b>Cuota:</b> #{g.numero_cuota}
                {g.numero_credito && ` · ${g.numero_credito}`}
              </div>
              <div>
                <b>Hora:</b>{" "}
                {new Date(g.fecha_hora).toLocaleTimeString("es-PY", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
              <div>
                <b>Cobrador:</b> {g.cobrador}
              </div>
              {g.comentario && (
                <div style={{ marginTop: 4, color: "#555" }}>
                  {g.comentario}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
