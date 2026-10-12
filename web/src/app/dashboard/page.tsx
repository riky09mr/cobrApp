"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ElementType } from "react";
import {
  ClipboardList, Clock, CheckCircle2, AlertTriangle,
  Banknote, User, Users, Building2,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { DashboardSummary } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

function Card({
  label,
  icon: Icon,
  value,
  sub,
  accent,
}: {
  label: string;
  icon?: ElementType;
  value: string | number;
  sub?: string;
  accent?: "red" | "amber" | "emerald";
}) {
  const valueClass =
    accent === "red"
      ? "text-red-600"
      : accent === "amber"
      ? "text-amber-600"
      : accent === "emerald"
      ? "text-emerald-700"
      : "text-blue-900";

  return (
    <article className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
      <div className="flex items-center gap-2 text-cyan-600">
        {Icon && <Icon size={15} />}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className={`mt-2 text-4xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-blue-400">{sub}</p>}
    </article>
  );
}

function gs(n: number) {
  return "Gs. " + Math.round(n).toLocaleString("es-PY");
}

export default function Dashboard() {
  useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await panelApi.getDashboardSummary();
        setSummary(data);
      } catch (err: unknown) {
        const apiError = err as { response?: { status?: number } };
        if (apiError.response?.status === 401) {
          localStorage.removeItem("cobrapp_token");
          localStorage.removeItem("cobrapp_user");
          router.push("/login");
        } else {
          setError("No se pudo cargar el dashboard");
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  return (
    <PanelShell title="Dashboard" description="Resumen de tu actividad">
      {loading && <p className="text-blue-700">Cargando métricas…</p>}
      {error   && <p className="text-red-600">{error}</p>}

      {/* ── COBRADOR ── */}
      {summary?.rol === "COBRADOR" && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-blue-800">Mis asignaciones</h2>
          <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card label="Asignaciones totales" icon={ClipboardList} value={summary.asignacionesTotales} />
            <Card label="Pendientes"           icon={Clock}         value={summary.asignacionesPendientes}  accent="amber" />
            <Card label="Completadas"          icon={CheckCircle2}  value={summary.asignacionesCompletadas} accent="emerald" />
            <Card label="Cuotas vencidas"      icon={AlertTriangle} value={summary.cuotasVencidas}          accent="red" sub="de mis asignaciones" />
            <Card label="Monto cobrado"        icon={Banknote}      value={gs(summary.montoCobrado)}        accent="emerald" sub="total histórico" />
          </section>
        </div>
      )}

      {/* ── SUPERVISOR ── */}
      {summary?.rol === "SUPERVISOR" && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-blue-800">Mi equipo</h2>
          <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card label="Cobradores activos"   icon={User}          value={summary.cobradores}               sub="en tu empresa" />
            <Card label="Clientes"             icon={Users}         value={summary.clientes}                 sub="en tu empresa" />
            <Card label="Asignaciones totales" icon={ClipboardList} value={summary.asignacionesTotales}      sub="supervisadas por vos" />
            <Card label="Pendientes"           icon={Clock}         value={summary.asignacionesPendientes}   accent="amber" />
            <Card label="Completadas"          icon={CheckCircle2}  value={summary.asignacionesCompletadas}  accent="emerald" />
            <Card label="Monto cobrado"        icon={Banknote}      value={gs(summary.montoCobrado)}         accent="emerald" sub="por tu equipo" />
          </section>
        </div>
      )}

      {/* ── ADMIN ── */}
      {summary?.rol === "ADMIN" && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-blue-800">Resumen general</h2>
          <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card label="Empresas activas"     icon={Building2}     value={summary.empresas} />
            <Card label="Clientes registrados" icon={Users}         value={summary.clientes} />
            <Card label="Usuarios activos"     icon={User}          value={summary.usuarios} />
            <Card label="Cuotas pendientes"    icon={Clock}         value={summary.cuotasPendientes}  accent="amber" />
            <Card label="Cuotas vencidas"      icon={AlertTriangle} value={summary.cuotasVencidas}    accent="red" />
            <Card label="Cuotas pagadas"       icon={CheckCircle2}  value={summary.cuotasPagadas}     accent="emerald" />
          </section>
        </div>
      )}
    </PanelShell>
  );
}
