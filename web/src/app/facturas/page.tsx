"use client";

import { Receipt, Save, ChevronDown, History, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Empresa, FacturaEmisor, FacturaTimbrado, FacturaConfigCompleta } from "@/services/api";

// ── Tipos de formulario ───────────────────────────────────────

type EmisorForm = {
  razon_social: string;
  ruc: string;
  ruc_dv: string;
  direccion: string;
  actividad_economica: string;
};

type TimbradoForm = {
  numero_timbrado: string;
  establecimiento: string;   // 3 digitos
  punto_emision: string;     // 3 digitos
  fecha_inicio: string;
  fecha_vencimiento: string;
  numero_desde: string;
  numero_hasta: string;
  es_electronica: boolean;
};

const EMPTY_EMISOR: EmisorForm = {
  razon_social: "", ruc: "", ruc_dv: "",
  direccion: "", actividad_economica: "",
};

const EMPTY_TIMBRADO: TimbradoForm = {
  numero_timbrado: "",
  establecimiento: "001",
  punto_emision:   "001",
  fecha_inicio: "",
  fecha_vencimiento: "",
  numero_desde: "1",
  numero_hasta: "9999999",
  es_electronica: false,
};

// ── Helpers ───────────────────────────────────────────────────

function cfgToEmisorForm(e: FacturaEmisor): EmisorForm {
  return {
    razon_social:        e.razon_social        ?? "",
    ruc:                 e.ruc                 ?? "",
    ruc_dv:              e.ruc_dv              ?? "",
    direccion:           e.direccion           ?? "",
    actividad_economica: e.actividad_economica ?? "",
  };
}

function cfgToTimbradoForm(t: FacturaTimbrado): TimbradoForm {
  return {
    numero_timbrado:  t.numero_timbrado,
    establecimiento:  t.establecimiento,
    punto_emision:    t.punto_emision,
    fecha_inicio:     t.fecha_inicio     ? String(t.fecha_inicio).substring(0, 10)     : "",
    fecha_vencimiento:t.fecha_vencimiento? String(t.fecha_vencimiento).substring(0, 10): "",
    numero_desde:     String(t.numero_desde),
    numero_hasta:     String(t.numero_hasta),
    es_electronica:   t.es_electronica === 1 || t.es_electronica === true,
  };
}

// ── Componente principal ──────────────────────────────────────

export default function FacturasPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin]         = useState(false);
  const [myEmpresaId, setMyEmpresaId] = useState<number | null>(null);

  const [empresas, setEmpresas]       = useState<Empresa[]>([]);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const [emisor,   setEmisor]         = useState<EmisorForm>(EMPTY_EMISOR);
  const [timbrado, setTimbrado]       = useState<TimbradoForm>(EMPTY_TIMBRADO);
  const [historial, setHistorial]     = useState<FacturaTimbrado[]>([]);

  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  // ── Auth & bootstrap ────────────────────────────────────────

  const handleApiError = (err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      localStorage.removeItem("cobrapp_token");
      localStorage.removeItem("cobrapp_user");
      router.push("/login");
    }
  };

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("cobrapp_user") || "{}") as {
        rol?: string; empresaId?: number;
      };
      const admin = u.rol === "ADMIN";
      setIsAdmin(admin);
      if (!admin && u.empresaId) {
        setMyEmpresaId(u.empresaId);
        setSelectedId(u.empresaId);
      }
      if (admin) void loadEmpresas();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) void loadConfig(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── Loaders ─────────────────────────────────────────────────

  const loadEmpresas = async () => {
    try {
      const data = await panelApi.getEmpresas();
      setEmpresas(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } catch (err) { handleApiError(err); }
  };

  const loadConfig = async (empresaId: number) => {
    setLoading(true); setError(null); setSuccess(false); setSaveError(null);
    try {
      const cfg = await panelApi.getFacturaConfig(empresaId) as FacturaConfigCompleta | null;
      setEmisor(cfg?.emisor   ? cfgToEmisorForm(cfg.emisor)     : EMPTY_EMISOR);
      setTimbrado(cfg?.timbrado ? cfgToTimbradoForm(cfg.timbrado) : EMPTY_TIMBRADO);
      // Historial de timbrados
      const hist = await panelApi.getTimbradoHistorial(empresaId);
      setHistorial(hist ?? []);
    } catch (err) {
      handleApiError(err);
      setError("No se pudo cargar la configuracion");
    } finally { setLoading(false); }
  };

  // ── Guardar ─────────────────────────────────────────────────

  const handleGuardar = async () => {
    const empresaId = selectedId ?? myEmpresaId;
    if (!empresaId) return;
    setSaving(true); setSaveError(null); setSuccess(false);
    try {
      await panelApi.updateFacturaConfig(empresaId, {
        emisor: {
          razon_social:        emisor.razon_social.trim()        || null,
          ruc:                 emisor.ruc.trim()                 || null,
          ruc_dv:              emisor.ruc_dv.trim()              || null,
          direccion:           emisor.direccion.trim()           || null,
          actividad_economica: emisor.actividad_economica.trim() || null,
        } as Partial<FacturaEmisor>,
        timbrado: {
          numero_timbrado:  timbrado.numero_timbrado.trim() || undefined,
          establecimiento:  timbrado.establecimiento.padStart(3, "0"),
          punto_emision:    timbrado.punto_emision.padStart(3, "0"),
          fecha_inicio:     timbrado.fecha_inicio     || null,
          fecha_vencimiento:timbrado.fecha_vencimiento|| null,
          numero_desde:     parseInt(timbrado.numero_desde,  10) || 1,
          numero_hasta:     parseInt(timbrado.numero_hasta,  10) || 9999999,
          es_electronica:   timbrado.es_electronica ? 1 : 0,
        } as Partial<FacturaTimbrado>,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      void loadConfig(empresaId);
    } catch (err) {
      handleApiError(err);
      const e = err as { response?: { data?: { message?: string } } };
      setSaveError(e?.response?.data?.message ?? "No se pudo guardar");
    } finally { setSaving(false); }
  };

  // ── Input helpers ────────────────────────────────────────────

  const E = (field: keyof EmisorForm) =>
    (ev: React.ChangeEvent<HTMLInputElement>) =>
      setEmisor(f => ({ ...f, [field]: ev.target.value }));

  const T = (field: keyof TimbradoForm) =>
    (ev: React.ChangeEvent<HTMLInputElement>) =>
      setTimbrado(f => ({ ...f, [field]: ev.target.value }));

  const inputCls = "w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const labelCls = "block text-xs font-medium text-blue-800 mb-1";

  // Vista previa del numero de factura
  const estab  = timbrado.establecimiento.padStart(3, "0");
  const punto  = timbrado.punto_emision.padStart(3, "0");
  const desde  = parseInt(timbrado.numero_desde, 10) || 1;
  const nroPreview = `${estab}-${punto}-${String(desde).padStart(7, "0")}`;

  const empresaActual = isAdmin ? empresas.find(e => e.id === selectedId) : null;

  return (
    <PanelShell
      title="Configuracion de Factura"
      description="Datos del emisor y timbrado segun normativa DNIT Paraguay"
    >
      <div className="space-y-6 max-w-3xl">

        {/* ── Selector de empresa (ADMIN) ──────────────────── */}
        {isAdmin && (
          <section className="rounded-xl border border-sky-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-sky-100">
              <Receipt size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-blue-900">Seleccionar empresa</h2>
            </div>
            <div className="px-6 py-4">
              <label className={labelCls}>Empresa</label>
              <div className="relative">
                <select
                  value={selectedId ?? ""}
                  onChange={e => setSelectedId(Number(e.target.value))}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.razon_social}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </section>
        )}

        {loading && <p className="text-blue-700 text-sm px-2">Cargando...</p>}
        {error   && <p className="text-red-600  text-sm px-2">{error}</p>}

        {!loading && (selectedId || myEmpresaId) && (
          <>
            {/* ── 1. Datos del Emisor ─────────────────────── */}
            <section className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-sky-50 border-b border-sky-100">
                <h3 className="text-sm font-semibold text-blue-900">1. Datos del Emisor (Membrete)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Informacion impresa en el encabezado de la factura</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={labelCls}>Nombre o Razon Social</label>
                  <input value={emisor.razon_social} onChange={E("razon_social")} className={inputCls}
                    placeholder="Ej: EMPRESA DEMO S.A." />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>RUC (sin digito verificador)</label>
                    <input value={emisor.ruc} onChange={E("ruc")} className={inputCls}
                      placeholder="Ej: 80026041" />
                  </div>
                  <div>
                    <label className={labelCls}>DV</label>
                    <input value={emisor.ruc_dv} onChange={E("ruc_dv")} className={inputCls}
                      placeholder="4" maxLength={1} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Actividad Economica</label>
                  <input value={emisor.actividad_economica} onChange={E("actividad_economica")} className={inputCls}
                    placeholder="Ej: Actividades de credito y cobranza" />
                </div>
                <div>
                  <label className={labelCls}>Direccion Fiscal</label>
                  <input value={emisor.direccion} onChange={E("direccion")} className={inputCls}
                    placeholder="Ej: Independencia Nacional 811, Asuncion" />
                </div>
              </div>
            </section>

            {/* ── 2. Timbrado ─────────────────────────────── */}
            <section className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-sky-50 border-b border-sky-100">
                <h3 className="text-sm font-semibold text-blue-900">2. Timbrado (DNIT)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Si ingresas un numero de timbrado distinto al actual, se crea un nuevo registro
                  y el anterior queda en el historial.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">

                {/* Numero de timbrado */}
                <div>
                  <label className={labelCls}>Numero de Timbrado (8 digitos)</label>
                  <input value={timbrado.numero_timbrado} onChange={T("numero_timbrado")} className={inputCls}
                    placeholder="Ej: 12345678" maxLength={20} />
                </div>

                {/* Establecimiento y Punto de Emision */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Establecimiento (3 dig.)</label>
                    <input
                      value={timbrado.establecimiento}
                      onChange={e => setTimbrado(f => ({ ...f, establecimiento: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                      maxLength={3} placeholder="001" className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">Casa Matriz = 001</p>
                  </div>
                  <div>
                    <label className={labelCls}>Punto de Emision (3 dig.)</label>
                    <input
                      value={timbrado.punto_emision}
                      onChange={e => setTimbrado(f => ({ ...f, punto_emision: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                      maxLength={3} placeholder="001" className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">Caja 1 = 001, Caja 2 = 002</p>
                  </div>
                </div>

                {/* Vigencia */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Fecha de Inicio de Vigencia</label>
                    <input type="date" value={timbrado.fecha_inicio} onChange={T("fecha_inicio")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de Vencimiento</label>
                    <input type="date" value={timbrado.fecha_vencimiento} onChange={T("fecha_vencimiento")} className={inputCls} />
                  </div>
                </div>

                {/* Rango autorizado */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Numero Desde (autorizado por DNIT)</label>
                    <input type="number" min={1} value={timbrado.numero_desde} onChange={T("numero_desde")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Numero Hasta (autorizado por DNIT)</label>
                    <input type="number" min={1} value={timbrado.numero_hasta} onChange={T("numero_hasta")} className={inputCls} />
                  </div>
                </div>

                {/* Tipo de factura: Impresa vs Electronica */}
                <div>
                  <label className={labelCls}>Tipo de Documento</label>
                  <div className="flex gap-4 mt-1">
                    <label className={`flex-1 flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors
                      ${!timbrado.es_electronica ? "border-blue-500 bg-blue-50" : "border-sky-200 hover:border-sky-300"}`}>
                      <input type="radio" name="tipo_doc" checked={!timbrado.es_electronica}
                        onChange={() => setTimbrado(f => ({ ...f, es_electronica: false }))}
                        className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Factura Impresa</p>
                        <p className="text-xs text-slate-500 mt-1">Genera PDF para entregar al cliente. Sin CDC ni firma digital.</p>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors
                      ${timbrado.es_electronica ? "border-blue-500 bg-blue-50" : "border-sky-200 hover:border-sky-300"}`}>
                      <input type="radio" name="tipo_doc" checked={timbrado.es_electronica}
                        onChange={() => setTimbrado(f => ({ ...f, es_electronica: true }))}
                        className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Documento Electronico SIFEN</p>
                        <p className="text-xs text-slate-500 mt-1">Genera CDC de 44 digitos, XML firmado y codigo QR de validacion.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Vista previa del numero */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-500 mb-1">Vista previa del primer numero de factura:</p>
                  <p className="text-lg font-mono font-bold text-blue-800 tracking-widest">{nroPreview}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Formato: establecimiento ({estab}) - punto emision ({punto}) - numero secuencial (7 digitos)
                  </p>
                </div>
              </div>
            </section>

            {/* ── Historial de timbrados ───────────────────── */}
            {historial.length > 0 && (
              <section className="rounded-xl border border-sky-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-3 bg-sky-50 border-b border-sky-100">
                  <History size={15} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-blue-900">Historial de Timbrados</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Timbrado</th>
                        <th className="px-4 py-2 text-left">Estab-Punto</th>
                        <th className="px-4 py-2 text-left">Vigencia</th>
                        <th className="px-4 py-2 text-center">Rango</th>
                        <th className="px-4 py-2 text-center">Actual</th>
                        <th className="px-4 py-2 text-center">Tipo</th>
                        <th className="px-4 py-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historial.map(t => (
                        <tr key={t.id} className={t.activo ? "bg-blue-50" : "text-slate-400"}>
                          <td className="px-4 py-2 font-mono font-semibold">{t.numero_timbrado}</td>
                          <td className="px-4 py-2 font-mono">{t.establecimiento}-{t.punto_emision}</td>
                          <td className="px-4 py-2">
                            {t.fecha_inicio ? String(t.fecha_inicio).substring(0,10) : "-"}
                            {" "}&rarr;{" "}
                            {t.fecha_vencimiento ? String(t.fecha_vencimiento).substring(0,10) : "-"}
                          </td>
                          <td className="px-4 py-2 text-center">{t.numero_desde} - {t.numero_hasta}</td>
                          <td className="px-4 py-2 text-center font-mono">{t.numero_actual}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                              ${t.es_electronica ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                              {t.es_electronica ? "SIFEN" : "Impresa"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {t.activo
                              ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
                              : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Vencido</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Alerta timbrado vencido ──────────────────── */}
            {historial.length > 0 && historial[0]?.fecha_vencimiento &&
              new Date(historial[0].fecha_vencimiento) < new Date() && historial[0].activo ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Timbrado vencido</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    El timbrado activo vencio el {String(historial[0].fecha_vencimiento).substring(0,10)}.
                    Ingresa el nuevo numero de timbrado otorgado por la DNIT para continuar emitiendo facturas.
                  </p>
                </div>
              </div>
            ) : null}

            {/* ── Feedback y boton guardar ─────────────────── */}
            {saveError && (
              <p className="text-red-600 text-sm px-1">{saveError}</p>
            )}
            {success && (
              <p className="text-green-600 text-sm font-medium px-1">Configuracion guardada correctamente</p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                           text-white text-sm font-semibold px-6 py-2.5 transition-colors"
              >
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar configuracion"}
              </button>
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}