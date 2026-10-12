"use client";

import { Pencil, Trash2, Undo2, Check } from "lucide-react";

import { useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PoligonoPoint } from "@/services/api";

// Small numbered dot icon for each vertex
function dotIcon(index: number, isFirst: boolean) {
  const size = isFirst ? 16 : 11;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${isFirst ? "#0369a1" : "#0ea5e9"};
      border:2px solid white;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
      font-size:7px;color:white;font-weight:bold;
    ">${index + 1}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClickHandler({ active, onMapClick }: { active: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  value: PoligonoPoint[];
  onChange: (points: PoligonoPoint[]) => void;
  color?: string;
}

export default function MapPolygonPicker({ value, onChange, color = "#0ea5e9" }: Props) {
  const [drawing, setDrawing] = useState(false);

  // Center on centroid of existing points, or default to Asunción
  const center: [number, number] =
    value.length > 0
      ? [
          value.reduce((s, p) => s + p.lat, 0) / value.length,
          value.reduce((s, p) => s + p.lng, 0) / value.length,
        ]
      : [-25.2867, -57.647];

  const handleMapClick = (lat: number, lng: number) => {
    if (!drawing) return;
    onChange([...value, { lat, lng }]);
  };

  const undo = () => onChange(value.slice(0, -1));

  const clear = () => {
    onChange([]);
    setDrawing(false);
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawing(!drawing)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            drawing
              ? "bg-cyan-600 text-white ring-2 ring-cyan-300"
              : "bg-sky-100 text-sky-700 hover:bg-sky-200"
          }`}
        >
          {drawing ? (
            <><Pencil size={13} className="inline" /> ACTIVO — click en el mapa para agregar puntos</>
          ) : (
            <><Pencil size={13} className="inline" /> Activar dibujo</>
          )}
        </button>

        {value.length > 0 && (
          <button
            type="button"
            onClick={undo}
            className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
          >
            <><Undo2 size={13} className="inline" /> Deshacer</>
          </button>
        )}

        {value.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-200"
          >
            <><Trash2 size={13} className="inline" /> Limpiar</>
          </button>
        )}

        <span className="ml-auto text-xs text-sky-500">
          {value.length} punto{value.length !== 1 ? "s" : ""}
          {value.length >= 3 ? <Check size={11} className="inline ml-0.5 text-emerald-500" /> : ""}
        </span>
      </div>

      {/* Map */}
      <div
        className="overflow-hidden rounded-lg border border-sky-200"
        style={{ cursor: drawing ? "crosshair" : "default" }}
      >
        <MapContainer center={center} zoom={13} style={{ height: 300, width: "100%" }} zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler active={drawing} onMapClick={handleMapClick} />

          {value.length >= 3 && (
            <Polygon
              positions={value.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2, dashArray: "4" }}
            />
          )}

          {value.map((p, i) => (
            <Marker
              key={i}
              position={[p.lat, p.lng]}
              icon={dotIcon(i, i === 0)}
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  onChange(value.map((pt, idx) => (idx === i ? { lat, lng } : pt)));
                },
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Status */}
      {value.length > 0 && value.length < 3 && (
        <p className="text-xs text-amber-500">
          Necesitás al menos 3 puntos para definir el polígono ({3 - value.length} más)
        </p>
      )}
      {value.length >= 3 && (
        <p className="text-xs text-emerald-600"><Check size={12} className="inline mr-1" />Polígono con {value.length} puntos · podés arrastrar cada punto para ajustar</p>
      )}
    </div>
  );
}
