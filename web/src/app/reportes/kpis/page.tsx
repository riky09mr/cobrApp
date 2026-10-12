"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  Download,
  Filter,
  Target,
  TrendingUp,
  Repeat,
  Wallet,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { ElementType } from "react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";
import { reportesApi } from "@/services/api";
import type { KpiItem } from "@/services/api";

// Iconos por clave de KPI
const KPI_ICONS: Record<string, { icon: ElementType; color: string; bg: string }> = {
  indice_morosidad: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  efectividad_cobro: { icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
  rotacion_cartera: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
  cobertura_cobro: { icon: ShieldCheck, color: "text-cyan-600", bg: "bg-cyan-50" },
  costo_gestion: { icon: Wallet, color: "text-purple-600", bg: "bg-purple-50" },
  tasa_reagendamiento: { icon: Repeat, color: "text-orange-600", bg: "bg-orange-50" },
};

// Fecha local (evita el bug de toISOString que usa UTC y adelanta un día tras las 20:00)
function hoyLocal(): string {
  const d = new Date();
  const año = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const día = String(d.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
}

const formatearMonto = (monto: number) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);

function formatearValor(kpi: KpiItem): string {
  if (kpi.valor === null || kpi.valor === undefined) return "—";
  if (kpi.unidad === "%" || kpi.unidad === "veces/año") {
    return `${Number(kpi.valor).toLocaleString("es-PY")} ${kpi.unidad}`;
  }
  return formatearMonto(Number(kpi.valor));
}

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const meta = KPI_ICONS[kpi.clave] ?? {
    icon: BarChart3,
    color: "text-blue-600",
    bg: "bg-blue-50",
  };
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-sky-200 bg-white p-5 shadow-md shadow-sky-100">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
          <Icon size={22} />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {kpi.clave.replace(/_/g, " ")}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-blue-900">{kpi.nombre}</h3>
      <p className="mt-1 text-3xl font-bold text-gray-900">{formatearValor(kpi)}</p>
      <p className="mt-2 text-xs leading-relaxed text-blue-500">{kpi.descripcion}</p>

      {kpi.detalle && Object.keys(kpi.detalle).length > 0 && (
        <div className="mt-3 space-y-1 border-t border-sky-100 pt-3">
          {Object.entries(kpi.detalle).map(([clave, valor]) => (
            <div key={clave} className="flex items-center justify-between text-xs">
              <span className="capitalize text-gray-500">{clave.replace(/_/g, " ")}</span>
              <span className="font-medium text-gray-800">
                {typeof valor === "number"
                  ? clave.includes("monto") || clave.includes("costo") || clave.includes("cartera")
                    ? formatearMonto(valor)
                    : Number(valor).toLocaleString("es-PY")
                  : valor ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KpisPage() {
  useAuth();

  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [periodo, setPeriodo] = useState<{ fecha_desde: string; fecha_hasta: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Usuario logueado: la empresa por defecto es la del usuario (admin/supervisor)
  const [esAdmin, setEsAdmin] = useState(false);
  const [esAdminSuper, setEsAdminSuper] = useState(false);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    const año = d.getFullYear();
    return `${año}-01-02`; // 2 de enero del año actual
  });
  const [fechaHasta, setFechaHasta] = useState(() => hoyLocal());
  const [costoOperativo, setCostoOperativo] = useState("500000");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaNombre, setEmpresaNombre] = useState<string>("");

  // Al montar en el cliente: la empresa por defecto es la del usuario logueado
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}") as {
        rol?: string;
        empresaId?: number;
        empresa_nombre?: string;
      };
      const adminSuper = u.rol === "ADMIN" || u.rol === "SUPERVISOR";
      setEsAdminSuper(adminSuper);
      setEsAdmin(u.rol === "ADMIN");
      if (adminSuper && u.empresaId) {
        setEmpresaId(String(u.empresaId));
      }
      if (u.empresa_nombre) {
        setEmpresaNombre(u.empresa_nombre);
      }
    } catch {
      // sin sesión: se mantienen los valores por defecto
    }
  }, []);

  // Solo se consulta al presionar el botón "Consultar"
  const cargar = useCallback(async (filtros: {
    fecha_desde: string;
    fecha_hasta: string;
    costo_operativo?: number;
    empresa_id?: number;
  }) => {
    setCargando(true);
    setError(null);
    try {
      const result = await reportesApi.getKpisResumen(filtros);
      setKpis(result.kpis);
      setPeriodo(result.periodo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar los KPIs";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, []);

  const consultar = () => {
    void cargar({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      costo_operativo: costoOperativo ? Number(costoOperativo) : undefined,
      empresa_id: esAdminSuper && empresaId ? Number(empresaId) : undefined,
    });
  };

  const escaparCelda = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

  function descargarCSV() {
    if (kpis.length === 0) return;

    const lineas: string[] = [];
    const sep = ";"; // Separador compatible con Excel es-PY (decimales con coma)

    // Metadatos
    lineas.push(escaparCelda("Reporte de KPIs de Gestión de Cobranza"));
    lineas.push(
      escaparCelda(
        `Período: ${periodo?.fecha_desde ?? fechaDesde} al ${periodo?.fecha_hasta ?? fechaHasta}`
      )
    );
    if (esAdminSuper && empresaId) {
      lineas.push(escaparCelda(`Empresa ID: ${empresaId}`));
    }
    lineas.push(escaparCelda(`Generado: ${new Date().toLocaleString("es-PY")}`));
    lineas.push("");

    // Resumen de indicadores
    lineas.push(["Indicador", "Valor", "Unidad", "Descripción"].join(sep));
    for (const kpi of kpis) {
      const valorTexto =
        kpi.valor === null || kpi.valor === undefined
          ? ""
          : String(kpi.valor).replace(".", ",");
      lineas.push(
        [
          escaparCelda(kpi.nombre),
          valorTexto,
          escaparCelda(kpi.unidad),
          escaparCelda(kpi.descripcion),
        ].join(sep)
      );
    }

    // Detalle por indicador
    lineas.push("");
    lineas.push(["Indicador", "Métrica", "Valor"].join(sep));
    for (const kpi of kpis) {
      for (const [clave, valor] of Object.entries(kpi.detalle ?? {})) {
        const etiqueta = clave.replace(/_/g, " ");
        const valorTexto =
          typeof valor === "number"
            ? clave.includes("monto") || clave.includes("costo") || clave.includes("cartera")
              ? valor.toLocaleString("es-PY", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })
              : String(valor).replace(".", ",")
            : valor ?? "";
        lineas.push([escaparCelda(kpi.nombre), escaparCelda(etiqueta), valorTexto].join(sep));
      }
    }

    const bom = "\uFEFF";
    const blob = new Blob([bom + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpis_${fechaDesde}_a_${fechaHasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PanelShell title="KPIs de Gestión de Cobranza">
      <div className="space-y-6">
        {/* Encabezado + filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              KPIs de Gestión de Cobranza
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="text-sm focus:outline-none"
                title="Desde"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="text-sm focus:outline-none"
                title="Hasta"
              />
            </div>
            <input
              type="number"
              value={costoOperativo}
              onChange={(e) => setCostoOperativo(e.target.value)}
              placeholder="Costo operativo"
              title="Costo operativo del período (para costo por gestión)"
              className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {esAdmin && (
              <div
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-gray-50"
                title="Empresa (por defecto la del usuario)"
              >
                <Building2 className="w-4 h-4 text-gray-400" />
                {empresaNombre || `Empresa ${empresaId}`}
              </div>
            )}
            <button
              onClick={consultar}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              {cargando ? "Cargando..." : "Consultar"}
            </button>
            <button
              onClick={descargarCSV}
              disabled={kpis.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Período */}
        {periodo && !cargando && !error && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
            <Info className="w-4 h-4" />
            Período analizado: <strong>{periodo.fecha_desde}</strong> al{" "}
            <strong>{periodo.fecha_hasta}</strong>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {cargando && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {!cargando && !error && kpis.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 px-6 py-14 text-center">
            <Filter className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Presiona <strong>Consultar</strong> para generar el reporte de KPIs.
            </p>
          </div>
        )}

        {!cargando && !error && kpis.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.clave} kpi={kpi} />
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}
