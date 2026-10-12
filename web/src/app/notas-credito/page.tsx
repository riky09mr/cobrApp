// "use client";
//
// import { useCallback, useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
//
// import PanelShell from "@/components/PanelShell";
// import { panelApi } from "@/services/api";
// import type { Recibo, Cobrador } from "@/services/api";
// import { useAuth } from "@/hooks/useAuth";
// import { usePermisos } from "@/hooks/usePermisos";
// import { Search, X, ChevronLeft, ChevronRight, FileText, Ban, Check, AlertTriangle } from "lucide-react";
//
// const today = () => new Date().toISOString().split("T")[0];
// const fISO = (s: string) => (s ?? "").split("T")[0].split(" ")[0];
//
// function estadoBadge(estado: string, aplicoNC: number | boolean) {
//   if (estado === "ANULADO") return "bg-red-100 text-red-700 border-red-200";
//   if (aplicoNC) return "bg-violet-100 text-violet-700 border-violet-200";
//   return "bg-emerald-100 text-emerald-700 border-emerald-200";
// }
//
// function estadoLabel(estado: string, aplicoNC: number | boolean) {
//   if (estado === "ANULADO") return "ANULADO";
//   if (aplicoNC) return "NOTA CRÉDITO";
//   return "EMITIDO";
// }
//
// export default function NotasCredito() {
//   useAuth();
//   const router = useRouter();
//   const { hasPermiso } = usePermisos();
//   const puedeEditar = hasPermiso("cobranzas", "editar");

//   // ── Filtros ──────────────────────────────────────────────
//   const [fechaDesde, setFechaDesde] = useState("");
//   const [fechaHasta, setFechaHasta] = useState("");
//   const [filtroEstado, setFiltroEstado] = useState<"" | "EMITIDO" | "ANULADO">("");
//   const [busqueda, setBusqueda] = useState("");
//   const [filtroCobrador, setFiltroCobrador] = useState("");
//
//   // ── Datos ────────────────────────────────────────────────
//   const [recibos, setRecibos] = useState<Recibo[]>([]);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [cobradores, setCobradores] = useState<Cobrador[]>([]);
//
//   // ── Paginación ───────────────────────────────────────────
//   const POR_PAGINA = 10;
//   const [pagina, setPagina] = useState(1);
//
//   // ── Modal nota de crédito ────────────────────────────────
//   const [modalNC, setModalNC] = useState<Recibo | null>(null);
//   const [formNC, setFormNC] = useState({ montoReal: "", motivo: "" });
//   const [guardandoNC, setGuardandoNC] = useState(false);
//   const [errNC, setErrNC] = useState<string | null>(null);
//
//   // ── Modal anular ─────────────────────────────────────────
//   const [modalAnular, setModalAnular] = useState<Recibo | null>(null);
//   const [formAnular, setFormAnular] = useState({ motivo: "", generarNC: false });
//   const [guardandoAnular, setGuardandoAnular] = useState(false);
//   const [errAnular, setErrAnular] = useState<string | null>(null);
//
//   // ── Mensaje de éxito ─────────────────────────────────────
//   const [exito, setExito] = useState<string | null>(null);
//
//   const cargar = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const res = await panelApi.getRecibos({
//         fechaDesde: fechaDesde || undefined,
//         fechaHasta: fechaHasta || undefined,
//         estado: filtroEstado || undefined,
//         busqueda: busqueda || undefined,
//         cobradorId: filtroCobrador ? Number(filtroCobrador) : undefined,
//         pagina,
//         porPagina: POR_PAGINA,
//       });
//       setRecibos(res.data);
//       setTotal(res.total);
//     } catch (err: unknown) {
//       const e = err as { response?: { status?: number } };
//       if (e.response?.status === 401) {
//         localStorage.removeItem("cobrapp_token");
//         localStorage.removeItem("cobrapp_user");
//         router.push("/login");
//       } else {
//         setError("No se pudieron cargar los recibos");
//       }
//     } finally {
//       setLoading(false);
//     }
//   }, [fechaDesde, fechaHasta, filtroEstado, busqueda, filtroCobrador, pagina, router]);
//
//   useEffect(() => { void cargar(); }, [cargar]);
//
//   useEffect(() => {
//     if (puedeEditar) {
//       panelApi
//         .getCobradores()
//         .then(setCobradores)
//         .catch(() => { /* silencioso */ });
//     }
//   }, [puedeEditar]);
//
//   useEffect(() => { setPagina(1); }, [busqueda, filtroEstado, filtroCobrador, fechaDesde, fechaHasta]);
//
//   // ── Métricas ─────────────────────────────────────────────
//   const metricas = useMemo(() => {
//     let emitidos = 0, anulados = 0, conNC = 0;
//     let montoEmitido = 0, montoSobrepago = 0;
//     for (const r of recibos) {
//       if (r.estado === "ANULADO") { anulados++; continue; }
//       emitidos++;
//       montoEmitido += Number(r.total_recibo ?? 0);
//       if (r.aplico_nota_credito) {
//         conNC++;
//         montoSobrepago += Number(r.monto_sobrepago ?? 0);
//       }
//     }
//     return { emitidos, anulados, conNC, montoEmitido, montoSobrepago };
//   }, [recibos]);
//
//   const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
//
//   function abrirModalNC(r: Recibo) {
//     setFormNC({ montoReal: String(Number(r.total_recibo ?? 0)), motivo: "" });
//     setErrNC(null);
//     setModalNC(r);
//   }
//
//   async function submitNC(e: React.FormEvent) {
//     e.preventDefault();
//     if (!modalNC) return;
//     setErrNC(null);
//     setGuardandoNC(true);
//     try {
//       const res = await panelApi.generarNotaCredito(modalNC.id, {
//         monto_real_cobrado: Number(formNC.montoReal),
//         motivo: formNC.motivo,
//       });
//       setExito(`Nota de crédito ${res.numeroNC ?? ""} generada por Gs. ${Number(res.montoSobrepago ?? 0).toLocaleString("es-PY")}`);
//       setModalNC(null);
//       await cargar();
//     } catch (err: unknown) {
//       const e = err as { response?: { data?: { message?: string } } };
//       setErrNC(e.response?.data?.message ?? "Error al generar nota de crédito");
//     } finally {
//       setGuardandoNC(false);
//     }
//   }
//
//   function abrirModalAnular(r: Recibo) {
//     setFormAnular({ motivo: "", generarNC: false });
//     setErrAnular(null);
//     setModalAnular(r);
//   }
//
//   async function submitAnular(e: React.FormEvent) {
//     e.preventDefault();
//     if (!modalAnular) return;
//     setErrAnular(null);
//     setGuardandoAnular(true);
//     try {
//       const res = await panelApi.anularRecibo(modalAnular.id, {
//         motivo: formAnular.motivo,
//         generar_nota_credito: formAnular.generarNC,
//       });
//       setExito(res.message ?? "Recibo anulado correctamente");
//       setModalAnular(null);
//       await cargar();
//     } catch (err: unknown) {
//       const e = err as { response?: { data?: { message?: string } } };
//       setErrAnular(e.response?.data?.message ?? "Error al anular recibo");
//     } finally {
//       setGuardandoAnular(false);
//     }
//   }
//
//   return (
//     <PanelShell title="Notas de Crédito" description="Gestión de notas de crédito por sobrepago y anulación de recibos">

//       {/* ── Barra superior ── */}
//       <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
//         <div className="flex flex-wrap gap-3">
//           <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
//             <span className="text-2xl font-bold text-emerald-600">{metricas.emitidos}</span>
//             <div className="leading-tight">
//               <p className="text-xs font-medium text-emerald-700">Emitidos</p>
//               <p className="text-[11px] text-emerald-500">Gs. {metricas.montoEmitido.toLocaleString("es-PY")}</p>
//             </div>
//           </div>
//           <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2">
//             <span className="text-2xl font-bold text-violet-600">{metricas.conNC}</span>
//             <div className="leading-tight">
//               <p className="text-xs font-medium text-violet-700">Con NC</p>
//               <p className="text-[11px] text-violet-500">Gs. {metricas.montoSobrepago.toLocaleString("es-PY")}</p>
//             </div>
//           </div>
//           <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
//             <span className="text-2xl font-bold text-red-600">{metricas.anulados}</span>
//             <div className="leading-tight">
//               <p className="text-xs font-medium text-red-700">Anulados</p>
//             </div>
//           </div>
//         </div>
//       </div>
//
//       {exito && (
//         <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
//           <span className="flex items-center gap-2"><Check size={16} /> {exito}</span>
//           <button onClick={() => setExito(null)} className="text-emerald-500 hover:text-emerald-700"><X size={14} /></button>
//         </div>
//       )}
//
//       <section className="rounded-xl border border-sky-200 bg-white p-6 shadow-md shadow-sky-100">
//         <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
//           <h2 className="text-lg font-semibold text-blue-900">Recibos de cobranza</h2>
//           <div className="flex flex-wrap items-center gap-2">
//             <div className="relative">
//               <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-300" />
//               <input
//                 type="text"
//                 placeholder="Buscar recibo / cliente / cédula…"
//                 value={busqueda}
//                 onChange={e => setBusqueda(e.target.value)}
//                 className="w-56 rounded-lg border border-sky-200 py-1.5 pl-8 pr-3 text-sm text-blue-900 placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               />
//             </div>
//             <input
//               type="date"
//               value={fechaDesde}
//               onChange={e => setFechaDesde(e.target.value)}
//               className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               title="Desde"
//             />
//             <input
//               type="date"
//               value={fechaHasta}
//               onChange={e => setFechaHasta(e.target.value)}
//               className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               title="Hasta"
//             />
//             <select
//               value={filtroEstado}
//               onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
//               className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//             >
//               <option value="">Todos los estados</option>
//               <option value="EMITIDO">Emitidos</option>
//               <option value="ANULADO">Anulados</option>
//             </select>
//             {puedeEditar && cobradores.length > 0 && (
//               <select
//                 value={filtroCobrador}
//                 onChange={e => setFiltroCobrador(e.target.value)}
//                 className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//               >
//                 <option value="">Todos los cobradores</option>
//                 {cobradores.map(cb => (
//                   <option key={cb.id} value={cb.id}>{cb.nombre} {cb.apellido ?? ""}</option>
//                 ))}
//               </select>
//             )}
//             {(busqueda || filtroEstado || filtroCobrador || fechaDesde || fechaHasta) && (
//               <button
//                 onClick={() => { setBusqueda(""); setFiltroEstado(""); setFiltroCobrador(""); setFechaDesde(""); setFechaHasta(""); }}
//                 className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
//               >
//                 <X size={12} />Limpiar
//               </button>
//             )}
//           </div>
//         </div>
//
//         {!loading && !error && (
//           <p className="mb-3 text-xs text-blue-400">
//             {total} recibo{total !== 1 ? "s" : ""} · pág. {pagina}/{totalPaginas}
//           </p>
//         )}
//
//         {loading && <p className="text-blue-700">Cargando recibos...</p>}
//         {error && <p className="text-red-600">{error}</p>}
//
//         {!loading && !error && (
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="border-b border-sky-100 text-left text-xs uppercase tracking-wide text-blue-400">
//                   <th className="px-3 py-2">Recibo</th>
//                   <th className="px-3 py-2">Fecha</th>
//                   <th className="px-3 py-2">Cliente</th>
//                   <th className="px-3 py-2">Cobrador</th>
//                   <th className="px-3 py-2">Medio de pago</th>
//                   <th className="px-3 py-2 text-right">Monto</th>
//                   <th className="px-3 py-2">Estado</th>
//                   <th className="px-3 py-2 text-right">Acciones</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-sky-50">
//                 {recibos.length === 0 && (
//                   <tr>
//                     <td colSpan={8} className="px-3 py-8 text-center text-blue-400">
//                       No hay recibos que coincidan con los filtros.
//                     </td>
//                   </tr>
//                 )}
//                 {recibos.map(r => (
//                   <tr key={r.id} className="hover:bg-sky-50/50">
//                     <td className="px-3 py-2.5">
//                       <span className="font-medium text-blue-900">{r.numero_recibo}</span>
//                       {r.numero_credito && (
//                         <span className="ml-1 text-xs text-blue-400">· {r.numero_credito}</span>
//                       )}
//                     </td>
//                     <td className="px-3 py-2.5 text-blue-700">
//                       {new Date(fISO(r.fecha_emision) + "T00:00:00").toLocaleDateString("es-PY")}
//                     </td>
//                     <td className="px-3 py-2.5">
//                       <span className="text-blue-900">{r.cliente_nombre} {r.cliente_apellido ?? ""}</span>
//                       {r.cliente_cedula && (
//                         <span className="ml-1 text-xs text-blue-400">CI: {r.cliente_cedula}</span>
//                       )}
//                     </td>
//                     <td className="px-3 py-2.5 text-blue-700">
//                       {r.cobrador_nombre} {r.cobrador_apellido ?? ""}
//                     </td>
//                     <td className="px-3 py-2.5 text-blue-700">
//                       {r.medio_pago_nombre ?? "—"}
//                       {r.nro_comprobante && (
//                         <span className="ml-1 text-xs text-blue-400">({r.nro_comprobante})</span>
//                       )}
//                     </td>
//                     <td className="px-3 py-2.5 text-right font-semibold text-blue-900">
//                       Gs. {Number(r.total_recibo).toLocaleString("es-PY")}
//                       {Number(r.monto_sobrepago) > 0 && (
//                         <span className="ml-1 text-xs font-normal text-violet-500">
//                           +{Number(r.monto_sobrepago).toLocaleString("es-PY")}
//                         </span>
//                       )}
//                     </td>
//                     <td className="px-3 py-2.5">
//                       <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${estadoBadge(r.estado, r.aplico_nota_credito)}`}>
//                         {estadoLabel(r.estado, r.aplico_nota_credito)}
//                       </span>
//                       {r.estado === "ANULADO" && r.motivo_anulacion && (
//                         <span className="mt-1 block text-[11px] text-red-400" title={r.motivo_anulacion}>
//                           {r.motivo_anulacion.length > 30 ? r.motivo_anulacion.slice(0, 30) + "…" : r.motivo_anulacion}
//                         </span>
//                       )}
//                     </td>
//                     <td className="px-3 py-2.5">
//                       <div className="flex items-center justify-end gap-1.5">
//                         {puedeEditar && r.estado !== "ANULADO" && !r.aplico_nota_credito && (
//                           <button
//                             onClick={() => abrirModalNC(r)}
//                             className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
//                             title="Generar nota de crédito por sobrepago"
//                           >
//                             <FileText size={12} /> Nota crédito
//                           </button>
//                         )}
//                         {puedeEditar && r.estado !== "ANULADO" && (
//                           <button
//                             onClick={() => abrirModalAnular(r)}
//                             className="flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
//                             title="Anular recibo"
//                           >
//                             <Ban size={12} /> Anular
//                           </button>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}

//         {/* ── Paginación ── */}
//         {!loading && !error && totalPaginas > 1 && (
//           <div className="mt-5 flex items-center justify-between border-t border-sky-100 pt-4">
//             <span className="text-xs text-blue-400">
//               Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
//             </span>
//             <div className="flex items-center gap-1">
//               <button
//                 onClick={() => setPagina(p => Math.max(1, p - 1))}
//                 disabled={pagina === 1}
//                 className="flex items-center gap-0.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-sky-50 disabled:opacity-40"
//               >
//                 <ChevronLeft size={13} /> Anterior
//               </button>
//               {Array.from({ length: totalPaginas }, (_, i) => i + 1)
//                 .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
//                 .reduce<(number | string)[]>((acc, p, i, arr) => {
//                   if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
//                   acc.push(p);
//                   return acc;
//                 }, [])
//                 .map((p, i) =>
//                   p === "…" ? (
//                     <span key={`e${i}`} className="px-1 text-xs text-blue-300">…</span>
//                   ) : (
//                     <button
//                       key={p}
//                       onClick={() => setPagina(p as number)}
//                       className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs transition ${
//                         p === pagina
//                           ? "border-blue-500 bg-blue-600 text-white"
//                           : "border-sky-200 text-blue-700 hover:bg-sky-50"
//                       }`}
//                     >
//                       {p}
//                     </button>
//                   )
//                 )}
//               <button
//                 onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
//                 disabled={pagina === totalPaginas}
//                 className="flex items-center gap-0.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-sky-50 disabled:opacity-40"
//               >
//                 Siguiente <ChevronRight size={13} />
//               </button>
//             </div>
//           </div>
//         )}
//       </section>
//
//       {/* ─────────────────────────────────────────────────────────
//           Modal: Generar nota de crédito
//       ───────────────────────────────────────────────────────── */}
//       {modalNC && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
//             <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
//               <h3 className="flex items-center gap-2 text-base font-semibold text-blue-900">
//                 <FileText size={16} className="text-violet-600" /> Nota de crédito por sobrepago
//               </h3>
//               <button onClick={() => setModalNC(null)} className="text-slate-400 hover:text-slate-600">
//                 <X size={18} />
//               </button>
//             </div>
//             <form onSubmit={(e) => void submitNC(e)} className="space-y-4 p-6">
//               {errNC && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errNC}</p>}
//
//               <div className="rounded-lg bg-sky-50 p-3 text-sm text-blue-800">
//                 <p><span className="font-medium">Recibo:</span> {modalNC.numero_recibo}</p>
//                 <p><span className="font-medium">Cliente:</span> {modalNC.cliente_nombre} {modalNC.cliente_apellido ?? ""}</p>
//                 <p><span className="font-medium">Monto registrado:</span> Gs. {Number(modalNC.total_recibo).toLocaleString("es-PY")}</p>
//                 <p className="mt-1 text-xs text-blue-500">
//                   Ingrese el monto <strong>real</strong> cobrado (según el comprobante del banco/POS). Si es mayor al monto registrado, se generará la nota de crédito por la diferencia.
//                 </p>
//               </div>
//
//               <label className="flex flex-col gap-1 text-xs text-blue-700">
//                 Monto real cobrado (Gs.) *
//                 <input
//                   required
//                   type="number"
//                   min={1}
//                   value={formNC.montoReal}
//                   onChange={e => setFormNC(p => ({ ...p, montoReal: e.target.value }))}
//                   className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//                 />
//                 {Number(formNC.montoReal) > Number(modalNC.total_recibo) && (
//                   <span className="text-violet-600">
//                     Sobrepago: Gs. {(Number(formNC.montoReal) - Number(modalNC.total_recibo)).toLocaleString("es-PY")}
//                   </span>
//                 )}
//                 {Number(formNC.montoReal) <= Number(modalNC.total_recibo) && (
//                   <span className="text-amber-600">
//                     <AlertTriangle size={11} className="inline" /> El monto debe ser mayor al registrado para generar nota de crédito.
//                   </span>
//                 )}
//               </label>
//
//               <label className="flex flex-col gap-1 text-xs text-blue-700">
//                 Motivo *
//                 <textarea
//                   required
//                   value={formNC.motivo}
//                   onChange={e => setFormNC(p => ({ ...p, motivo: e.target.value }))}
//                   rows={3}
//                   placeholder="Ej: El cliente transfirió Gs. 1.000.000 pero la cuota era de Gs. 800.000"
//                   className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//                 />
//               </label>
//
//               <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
//                 <button type="button" onClick={() => setModalNC(null)}
//                   className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-blue-700 hover:bg-sky-50">
//                   Cancelar
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={guardandoNC || Number(formNC.montoReal) <= Number(modalNC.total_recibo)}
//                   className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
//                 >
//                   {guardandoNC ? "Generando…" : <><FileText size={14} /> Generar nota de crédito</>}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//
//       {/* ─────────────────────────────────────────────────────────
//           Modal: Anular recibo
//       ───────────────────────────────────────────────────────── */}
//       {modalAnular && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
//             <div className="flex items-center justify-between border-b border-sky-100 px-6 py-4">
//               <h3 className="flex items-center gap-2 text-base font-semibold text-blue-900">
//                 <Ban size={16} className="text-red-600" /> Anular recibo
//               </h3>
//               <button onClick={() => setModalAnular(null)} className="text-slate-400 hover:text-slate-600">
//                 <X size={18} />
//               </button>
//             </div>
//             <form onSubmit={(e) => void submitAnular(e)} className="space-y-4 p-6">
//               {errAnular && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errAnular}</p>}
//
//               <div className="rounded-lg bg-sky-50 p-3 text-sm text-blue-800">
//                 <p><span className="font-medium">Recibo:</span> {modalAnular.numero_recibo}</p>
//                 <p><span className="font-medium">Cliente:</span> {modalAnular.cliente_nombre} {modalAnular.cliente_apellido ?? ""}</p>
//                 <p><span className="font-medium">Monto:</span> Gs. {Number(modalAnular.total_recibo).toLocaleString("es-PY")}</p>
//               </div>
//
//               <label className="flex flex-col gap-1 text-xs text-blue-700">
//                 Motivo de anulación *
//                 <textarea
//                   required
//                   value={formAnular.motivo}
//                   onChange={e => setFormAnular(p => ({ ...p, motivo: e.target.value }))}
//                   rows={3}
//                   placeholder="Ej: Pago registrado por error"
//                   className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
//                 />
//               </label>
//
//               <label className="flex items-center gap-2 text-xs text-blue-700">
//                 <input
//                   type="checkbox"
//                   checked={formAnular.generarNC}
//                   onChange={e => setFormAnular(p => ({ ...p, generarNC: e.target.checked }))}
//                   className="h-4 w-4 rounded border-sky-300 text-violet-600 focus:ring-violet-300"
//                 />
//                 Generar nota de crédito fiscal por el monto anulado
//               </label>
//
//               <div className="flex justify-end gap-3 border-t border-sky-100 pt-4">
//                 <button type="button" onClick={() => setModalAnular(null)}
//                   className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-blue-700 hover:bg-sky-50">
//                   Cancelar
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={guardandoAnular}
//                   className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
//                 >
//                   {guardandoAnular ? "Anulando…" : <><Ban size={14} /> Anular recibo</>}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </PanelShell>
//   );
// }
