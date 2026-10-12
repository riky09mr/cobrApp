"use client";

import { useRouter } from "next/navigation";
import {
  BarChart3, TrendingUp, Users, Banknote, Clock,
  CalendarCheck, AlertTriangle, PieChart,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { useAuth } from "@/hooks/useAuth";

interface ReporteCard {
  id: number;
  titulo: string;
  descripcion: string;
  icono: React.ElementType;
  ruta: string;
  color: string;
  bgColor: string;
  hoverBg: string;
}

const REPORTES: ReporteCard[] = [
  {
    id: 0,
    titulo: "KPIs de Gestión de Cobranza",
    descripcion: "Morosidad, efectividad, rotación de cartera, cobertura, costo por gestión y tasa de reagendamiento.",
    icono: PieChart,
    ruta: "/reportes/kpis",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    hoverBg: "hover:bg-violet-100",
  },
  {
    id: 1,
    titulo: "Eficiencia de Cobradores",
    descripcion: "Rendimiento individual: asignaciones, cobros, visitas y efectividad por cobrador.",
    icono: TrendingUp,
    ruta: "/reportes/cobrador",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    hoverBg: "hover:bg-emerald-100",
  },
  {
    id: 2,
    titulo: "Cartera Vencida por Antigüedad",
    descripcion: "Distribución de la deuda vencida en rangos: 1-30, 31-60, 61-90 y 90+ días.",
    icono: AlertTriangle,
    ruta: "/reportes/cartera",
    color: "text-red-600",
    bgColor: "bg-red-50",
    hoverBg: "hover:bg-red-100",
  },
  {
    id: 3,
    titulo: "Cobranza por Período",
    descripcion: "Evolución diaria/semanal/mensual de montos cobrados y cantidad de cobros.",
    icono: Banknote,
    ruta: "/reportes/periodo",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    hoverBg: "hover:bg-blue-100",
  },
  {
    id: 7,
    titulo: "Morosidad por Cliente",
    descripcion: "Clientes con cuotas vencidas, montos adeudados y días de atraso.",
    icono: Clock,
    ruta: "/reportes/morosidad",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    hoverBg: "hover:bg-rose-100",
  },
  {
    id: 8,
    titulo: "Cobradores del Día",
    descripcion: "Cobradores en actividad hoy: asignaciones del día, cobros en tiempo real.",
    icono: CalendarCheck,
    ruta: "/reportes/cobradores-dia",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    hoverBg: "hover:bg-indigo-100",
  },
  {
    id: 9,
    titulo: "Ranking de Cobradores",
    descripcion: "Top de cobradores por monto cobrado, eficiencia y visitas efectivas.",
    icono: Users,
    ruta: "/reportes/ranking",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    hoverBg: "hover:bg-teal-100",
  },
];

export default function ReportesPage() {
  useAuth();
  const router = useRouter();

  return (
    <PanelShell title="Reportes" description="Centro de reportes del sistema">
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 text-white shadow-md">
              <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900">Centro de Reportes</h2>
              <p className="text-sm text-blue-500">
                Seleccioná un reporte para visualizar los datos
              </p>
            </div>
          </div>
        </div>

        {/* Grilla de reportes */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTES.map((r) => {
            const Icon = r.icono;
            return (
              <button
                key={r.id}
                onClick={() => router.push(r.ruta)}
                className={`group rounded-xl border border-sky-200 bg-white p-5 text-left shadow-md shadow-sky-100 transition-all ${r.hoverBg} hover:shadow-lg hover:shadow-sky-200 hover:-translate-y-0.5`}
              >
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${r.bgColor} ${r.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="mb-1 font-semibold text-blue-900 group-hover:text-blue-700">
                  {r.titulo}
                </h3>
                <p className="text-xs leading-relaxed text-blue-500">
                  {r.descripcion}
                </p>
                {r.ruta === "#" && (
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                    Próximamente
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}
