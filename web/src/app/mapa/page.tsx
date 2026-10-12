"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Gestion, Cobrador } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

const MapaVisitas = dynamic(() => import("@/components/MapaVisitas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sm text-sky-400">
      Cargando mapa…
    </div>
  ),
});

const RESULTADO_CLASSES: Record<string, string> = {
  cobrado:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  ausente:    "bg-red-100 text-red-700 border-red-200",
  reagendado: "bg-amber-100 text-amber-700 border-amber-200",
};
const RESULTADO_LABEL: Record<string, string> = {
  cobrado: "Cobrado", ausente: "Ausente", reagendado: "Reagendado",
};

function getUserRol(): string {
  try {
    const raw = localStorage.getItem("cobrapp_user");
    return raw ? (JSON.parse(raw) as { rol?: string }).rol ?? "" : "";
  } catch { return ""; }
}

export default function MapaPage() {
  useAuth();
  const router = useRouter();

  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const [rol, setRol]          = useState("");

  const [filtroCobrador,  setFiltroCobrador]  = useState("");
  const [filtroFecha,     setFiltroFecha]     = useState(
    () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Asuncion" })
  );
  const [filtroResultado, setFiltroResultado] = useState("");

  useEffect(() => { setRol(getUserRol()); }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, cobs] = await Promise.all([
        panelApi.getGestiones({
          cobradorId: filtroCobrador ? Number(filtroCobrador) : undefined,
          fecha:      filtroFecha    || undefined,
          resultado:  filtroResultado || undefined,
        }),
        panelApi.getCobradores(),
      ]);
      setGestiones(data);
      setCobradores(cobs);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError("No se pudo cargar las visitas");
      }
    } finally {
      setLoading(false);
    }
  }, [filtroCobrador, filtroFecha, filtroResultado, router]);

  useEffect(() => { void cargar(); }, [cargar]);

  const conCoords    = gestiones.filter((g) => g.latitud != null && g.longitud != null);
  const sinCoords    = gestiones.length - conCoords.length;
  const totalCobrado = gestiones
    .filter((g) => g.resultado === "cobrado")
    .reduce((s, g) => s + Number(g.monto_cobrado ?? 0), 0);

  return (
    <PanelShell title="Mapa de visitas" description="Ubicación georreferenciada de las visitas realizadas">
      <div className="flex flex-col gap-4 h-full">

        {/* ── Filtros ── */}
        <section className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            {rol !== "COBRADOR" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-blue-700">Cobrador</label>
                <select
                  value={filtroCobrador}
                  onChange={(e) => setFiltroCobrador(e.target.value)}
                  className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <option value="">Todos</option>
                  {cobradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido ?? ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700">Fecha</label>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700">Resultado</label>
              <select
                value={filtroResultado}
                onChange={(e) => setFiltroResultado(e.target.value)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">Todos</option>
                <option value="cobrado">Cobrado</option>
                <option value="ausente">Ausente</option>
                <option value="reagendado">Reagendado</option>
              </select>
            </div>

            <button
              onClick={() => { setFiltroFecha(""); setFiltroCobrador(""); setFiltroResultado(""); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
            >
              Limpiar
            </button>

            {/* ── Leyenda ── */}
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white shadow" />
                Cobrado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500 ring-2 ring-white shadow" />
                Ausente
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white shadow" />
                Reagendado
              </span>
            </div>
          </div>
        </section>

        {/* ── Contadores ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs text-sky-600">En mapa</p>
            <p className="text-2xl font-bold text-sky-700">{conCoords.length}</p>
            <p className="text-xs text-sky-400">de {gestiones.length} visitas</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">Cobros</p>
            <p className="text-2xl font-bold text-emerald-700">
              {gestiones.filter((g) => g.resultado === "cobrado").length}
            </p>
            <p className="text-xs text-emerald-500">
              Gs. {totalCobrado.toLocaleString("es-PY")}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-600">Ausentes</p>
            <p className="text-2xl font-bold text-red-700">
              {gestiones.filter((g) => g.resultado === "ausente").length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Sin coordenadas</p>
            <p className="text-2xl font-bold text-slate-600">{sinCoords}</p>
            <p className="text-xs text-slate-400">no visibles en mapa</p>
          </div>
        </div>

        {/* ── Mapa ── */}
        <section className="flex-1 min-h-105 rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-blue-500">
              Cargando visitas…
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center text-sm text-red-500">
              {error}
            </div>
          )}
          {!loading && !error && gestiones.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No hay visitas para los filtros seleccionados.
            </div>
          )}
          {!loading && !error && (
            <MapaVisitas gestiones={gestiones} />
          )}
        </section>

        {/* ── Lista debajo del mapa (visitas sin coords) ── */}
        {!loading && !error && sinCoords > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Visitas sin geolocalización ({sinCoords})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Hora</th>
                    {rol !== "COBRADOR" && <th className="px-4 py-2">Cobrador</th>}
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Resultado</th>
                    <th className="px-4 py-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gestiones
                    .filter((g) => g.latitud == null || g.longitud == null)
                    .map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                          {new Date(g.fecha_hora).toLocaleTimeString("es-PY", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        {rol !== "COBRADOR" && (
                          <td className="px-4 py-2 text-slate-700">{g.cobrador}</td>
                        )}
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {g.cliente_nombre} {g.cliente_apellido ?? ""}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RESULTADO_CLASSES[g.resultado] ?? ""}`}>
                            {RESULTADO_LABEL[g.resultado] ?? g.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {g.monto_cobrado
                            ? `Gs. ${Number(g.monto_cobrado).toLocaleString("es-PY")}`
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </PanelShell>
  );
}
