"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, CreditCard, MapPin, Save, User, X,
} from "lucide-react";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { CreateClientePayload, Empresa } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

const CREDITO_VACIO = {
  numero_credito: "", descripcion: "", precio_contado: "", entrega_inicial: "",
  monto_total: "", cantidad_cuotas: "", cuotas_pagadas: "", monto_cuota: "",
  dia_pago: "", periodicidad: "MENSUAL", tasa_interes: "", fecha_otorgamiento: "",
};

export default function ImportarManual() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [currentUserRol, setCurrentUserRol] = useState<string | null>(null);
  const [currentUserEmpresaId, setCurrentUserEmpresaId] = useState<number>(0);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // ── Formulario cliente ─────────────────────────────────────
  const [form, setForm] = useState<CreateClientePayload>({
    cedula: "", nombre: "", apellido: "", telefono: "", email: "", direccion: "",
    latitud: "", longitud: "", empresa_id: 0,
  });
  const [conCredito, setConCredito] = useState(false);
  const [credito, setCredito] = useState({ ...CREDITO_VACIO });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; creditoId: number | null } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("cobrapp_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { rol?: string; empresaId?: number };
        const rol = u.rol ?? null;
        setCurrentUserRol(rol);
        if (!hasPermiso("importar", "crear")) {
          router.replace("/dashboard");
          return;
        }
        if (rol !== "ADMIN" && u.empresaId) {
          setForm((f) => ({ ...f, empresa_id: u.empresaId ?? 0 }));
          setCurrentUserEmpresaId(u.empresaId ?? 0);
        }
        panelApi
          .getEmpresas()
          .then(setEmpresas)
          .catch(() => setError("No se pudo cargar la lista de empresas"));
      } catch {
        setError("No se pudo leer la sesión del usuario");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const num = (v: string) => {
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? undefined : n;
  };

  const limpiar = () => {
    setForm({
      cedula: "", nombre: "", apellido: "", telefono: "", email: "", direccion: "",
      latitud: "", longitud: "",
      empresa_id: currentUserRol !== "ADMIN" ? currentUserEmpresaId : 0,
    });
    setConCredito(false);
    setCredito({ ...CREDITO_VACIO });
    setError(null);
    setSuccess(null);
  };

  const handleGuardar = async () => {
    if (!form.cedula.trim() || !form.nombre.trim()) {
      setError("CI/RUC y Nombre son obligatorios");
      return;
    }
    if (currentUserRol === "ADMIN" && !form.empresa_id) {
      setError("Seleccioná una empresa");
      return;
    }
    if (conCredito) {
      if (!credito.monto_total.trim() || !credito.cantidad_cuotas.trim()) {
        setError("Para registrar el crédito, monto total y cantidad de cuotas son obligatorios");
        return;
      }
      const cant = Number(credito.cantidad_cuotas);
      if (Number.isNaN(cant) || cant <= 0 || cant > 1000) {
        setError("Cantidad de cuotas inválida (1 a 1000)");
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CreateClientePayload = { ...form };
      if (conCredito) {
        payload.credito = {
          numero_credito: credito.numero_credito.trim() || undefined,
          descripcion: credito.descripcion.trim() || undefined,
          precio_contado: num(credito.precio_contado),
          entrega_inicial: num(credito.entrega_inicial),
          monto_total: num(credito.monto_total) ?? 0,
          cantidad_cuotas: num(credito.cantidad_cuotas) ?? 0,
          cuotas_pagadas: num(credito.cuotas_pagadas) ?? 0,
          monto_cuota: num(credito.monto_cuota),
          dia_pago: num(credito.dia_pago),
          periodicidad: (credito.periodicidad as "SEMANAL" | "QUINCENAL" | "MENSUAL") || "MENSUAL",
          tasa_interes: num(credito.tasa_interes) ?? 0,
          fecha_otorgamiento: credito.fecha_otorgamiento || undefined,
        };
      }
      const resp = await panelApi.crearCliente(payload);
      setSuccess({
        message: resp.message ?? "Cliente guardado correctamente",
        creditoId: resp.data?.credito_id ?? null,
      });
      limpiar();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-500";
  const labelCls = "mb-1 block text-sm font-medium text-blue-900";

  return (
    <PanelShell title="Carga manual" description="Alta de cliente y cuotas sin usar Excel">
      <div className="mx-auto max-w-7xl space-y-6 px-2">
        <button
          onClick={() => router.push("/importar")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-sky-100"
        >
          <ArrowLeft size={14} /> Volver a Importar Excel
        </button>

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="flex items-center gap-1.5 font-semibold text-green-800">
              <CheckCircle2 size={16} /> {success.message}
            </p>
            {success.creditoId && (
              <p className="mt-1 text-sm text-green-700">Crédito N° {success.creditoId} y sus cuotas fueron generados.</p>
            )}
            <button
              onClick={limpiar}
              className="mt-2 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Cargar otro cliente
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Formulario en dos columnas ── */}
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          {/* ── Datos del cliente ── */}
          <section className="flex flex-col rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-blue-700">
              <User size={16} />
            </span>
            <h2 className="text-base font-bold text-blue-900">Datos del cliente</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Empresa *</label>
              <select
                value={form.empresa_id}
                onChange={(e) => setForm((f) => ({ ...f, empresa_id: parseInt(e.target.value, 10) }))}
                disabled={currentUserRol !== "ADMIN"}
                className={`${inputCls} ${currentUserRol !== "ADMIN" ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {currentUserRol === "ADMIN" && <option value={0}>Seleccioná una empresa</option>}
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                ))}
              </select>
              {currentUserRol !== "ADMIN" && (
                <p className="mt-1 text-xs text-blue-500">Se asignará a la empresa de tu cuenta</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>CI / RUC *</label>
                <input type="text" className={inputCls} placeholder="1234567"
                  value={form.cedula ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, cedula: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Nombre *</label>
                <input type="text" className={inputCls} placeholder="Juan"
                  value={form.nombre ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <input type="text" className={inputCls} placeholder="Pérez"
                  value={form.apellido ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input type="text" className={inputCls} placeholder="0981123456"
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} placeholder="juan@ejemplo.com"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Dirección</label>
                <input type="text" className={inputCls} placeholder="Calle Principal 123"
                  value={form.direccion ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><MapPin size={12} className="inline mr-1" />Latitud</label>
                <input type="text" className={inputCls} placeholder="-25.2867"
                  value={form.latitud ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, latitud: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}><MapPin size={12} className="inline mr-1" />Longitud</label>
                <input type="text" className={inputCls} placeholder="-57.6478"
                  value={form.longitud ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, longitud: e.target.value }))} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Crédito y cuotas ── */}
        <section className="rounded-xl border border-cyan-200 bg-white p-6 shadow-md shadow-cyan-100">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
              <CreditCard size={16} />
            </span>
            <h2 className="text-base font-bold text-blue-900">Crédito y cuotas</h2>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-900">
            <input
              type="checkbox"
              checked={conCredito}
              onChange={(e) => setConCredito(e.target.checked)}
              className="h-4 w-4 accent-cyan-600"
            />
            Registrar crédito y generar cuotas
          </label>
          <p className="mt-1 text-xs text-blue-500">
            Opcional: los mismos datos del Excel de importación. Las cuotas se generan automáticamente.
          </p>

          {conCredito && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>N° Crédito</label>
                <input type="text" className={inputCls} placeholder="CRED-001"
                  value={credito.numero_credito}
                  onChange={(e) => setCredito((c) => ({ ...c, numero_credito: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Descripción</label>
                <input type="text" className={inputCls} placeholder='Tele Samsung 55"'
                  value={credito.descripcion}
                  onChange={(e) => setCredito((c) => ({ ...c, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Monto total *</label>
                <input type="text" className={inputCls} placeholder="2500000"
                  value={credito.monto_total}
                  onChange={(e) => setCredito((c) => ({ ...c, monto_total: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Cantidad de cuotas *</label>
                <input type="number" min={1} max={1000} className={inputCls} placeholder="10"
                  value={credito.cantidad_cuotas}
                  onChange={(e) => setCredito((c) => ({ ...c, cantidad_cuotas: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Cuotas pagadas</label>
                <input type="number" min={0} className={inputCls} placeholder="0"
                  value={credito.cuotas_pagadas}
                  onChange={(e) => setCredito((c) => ({ ...c, cuotas_pagadas: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Monto por cuota</label>
                <input type="text" className={inputCls} placeholder="250000 (vacío = calculado)"
                  value={credito.monto_cuota}
                  onChange={(e) => setCredito((c) => ({ ...c, monto_cuota: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Día de pago</label>
                <input type="number" min={1} max={31} className={inputCls} placeholder="10"
                  value={credito.dia_pago}
                  onChange={(e) => setCredito((c) => ({ ...c, dia_pago: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Periodicidad</label>
                <select className={inputCls}
                  value={credito.periodicidad}
                  onChange={(e) => setCredito((c) => ({ ...c, periodicidad: e.target.value }))}>
                  <option value="MENSUAL">Mensual</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Tasa de interés (%)</label>
                <input type="number" step="0.01" min={0} className={inputCls} placeholder="5.5"
                  value={credito.tasa_interes}
                  onChange={(e) => setCredito((c) => ({ ...c, tasa_interes: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Fecha de otorgamiento</label>
                <input type="date" className={inputCls}
                  value={credito.fecha_otorgamiento}
                  onChange={(e) => setCredito((c) => ({ ...c, fecha_otorgamiento: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Precio contado</label>
                <input type="text" className={inputCls} placeholder="1800000"
                  value={credito.precio_contado}
                  onChange={(e) => setCredito((c) => ({ ...c, precio_contado: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Entrega inicial</label>
                <input type="text" className={inputCls} placeholder="500000"
                  value={credito.entrega_inicial}
                  onChange={(e) => setCredito((c) => ({ ...c, entrega_inicial: e.target.value }))} />
              </div>
            </div>
          )}
          </section>
        </div>

        {/* ── Acciones ── */}
        <div className="flex gap-3">
          <button
            onClick={limpiar}
            className="flex items-center justify-center gap-2 rounded-lg border border-sky-300 px-6 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50"
          >
            <X size={14} /> Limpiar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={14} /> {saving ? "Guardando..." : "Guardar cliente"}
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
