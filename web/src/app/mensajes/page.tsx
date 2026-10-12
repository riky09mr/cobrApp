"use client";

import { MessageSquare, Send, ChevronLeft, Paperclip, X, Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import type { Conversacion, MensajeChat } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermisos } from "@/hooks/usePermisos";

function formatHora(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismodia =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear();
  if (mismodia) return d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
}

function iniciales(nombre: string, apellido: string) {
  return ((nombre[0] ?? "") + (apellido[0] ?? "")).toUpperCase();
}

export default function Mensajes() {
  useAuth();
  const router = useRouter();
  const { hasPermiso } = usePermisos();

  const [userId, setUserId] = useState(0);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [contacto, setContacto] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [imagenPendiente, setImagenPendiente] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApiError = useCallback((err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      localStorage.removeItem("cobrapp_token");
      localStorage.removeItem("cobrapp_user");
      router.push("/login");
    }
  }, [router]);

  const loadConversaciones = useCallback(async () => {
    try {
      const data = await panelApi.getConversaciones();
      setConversaciones(data);
    } catch (err) { handleApiError(err); }
    finally { setLoadingConvs(false); }
  }, [handleApiError]);

  useEffect(() => {
    const raw = localStorage.getItem("cobrapp_user");
    if (raw) {
      try { setUserId((JSON.parse(raw) as { id?: number }).id ?? 0); } catch {}
    }
    void loadConversaciones();
  }, [loadConversaciones]);

  const loadMensajes = useCallback(async (uid: number) => {
    try {
      const data = await panelApi.getConversacion(uid);
      setMensajes(data);
      // Actualizar no_leidos en la lista
      setConversaciones(prev =>
        prev.map(c => c.id === uid ? { ...c, no_leidos: 0 } : c)
      );
    } catch (err) { handleApiError(err); }
  }, [handleApiError]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const seleccionarContacto = useCallback((c: Conversacion) => {
    setContacto(c);
    setLoadingChat(true);
    setMensajes([]);
    setErrorEnvio(null);
    panelApi.getConversacion(c.id)
      .then(data => { setMensajes(data); setLoadingChat(false); })
      .catch(err => { handleApiError(err); setLoadingChat(false); });

    // Polling cada 5s
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => void loadMensajes(c.id), 5000);
  }, [handleApiError, loadMensajes]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleEnviar = async () => {
    if (!contacto || (!texto.trim() && !imagenPendiente)) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await panelApi.enviarMensaje(contacto.id, texto.trim(), imagenPendiente ?? undefined);
      setTexto("");
      setImagenPendiente(null);
      setPreviewUrl(null);
      await loadMensajes(contacto.id);
      const preview = texto.trim().slice(0, 60) || "[Imagen]";
      setConversaciones(prev =>
        prev.map(c => c.id === contacto.id
          ? { ...c, ultimo_mensaje: preview, ultima_fecha: new Date().toISOString() }
          : c)
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorEnvio(e?.response?.data?.message ?? "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagenPendiente(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const quitarImagen = () => {
    setImagenPendiente(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleEnviar(); }
  };

  const BASE_URL = "http://localhost:5000";

  return (
    <PanelShell title="Mensajes" description="Mensajería interna con tu equipo">
      <div
        className="flex overflow-hidden rounded-xl border border-sky-200 bg-white shadow-md"
        style={{ height: "70vh", minHeight: "400px" }}
      >
        {/* ── Panel izquierdo: contactos ─────────────────────── */}
        <div className="flex w-72 shrink-0 flex-col border-r border-sky-100">
          <div className="border-b border-sky-100 px-4 py-3">
            <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <MessageSquare size={15} className="text-blue-500" /> Conversaciones
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs && <p className="px-4 py-6 text-sm text-blue-400">Cargando…</p>}
            {!loadingConvs && conversaciones.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400">No hay contactos disponibles</p>
            )}
            {conversaciones.map(c => (
              <button
                key={c.id}
                onClick={() => seleccionarContacto(c)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sky-50 ${contacto?.id === c.id ? "bg-sky-50 border-r-2 border-blue-500" : ""}`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {iniciales(c.nombre, c.apellido)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-blue-900">
                      {c.nombre} {c.apellido}
                    </p>
                    {c.no_leidos > 0 && (
                      <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
                        {c.no_leidos}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {c.ultimo_mensaje ?? "Sin mensajes aún"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Panel derecho: chat ───────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!contacto ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <MessageSquare size={40} strokeWidth={1.5} />
              <p className="text-sm">Seleccioná un contacto para chatear</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-sky-100 px-4 py-3">
                <button
                  onClick={() => { setContacto(null); if (pollingRef.current) clearInterval(pollingRef.current); }}
                  className="rounded-full p-1 text-slate-400 hover:bg-sky-50 hover:text-slate-600 md:hidden"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {iniciales(contacto.nombre, contacto.apellido)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">{contacto.nombre} {contacto.apellido}</p>
                  <p className="text-xs text-slate-400">{contacto.rol}</p>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loadingChat && <p className="text-center text-sm text-blue-400">Cargando mensajes…</p>}
                {!loadingChat && mensajes.length === 0 && (
                  <p className="text-center text-sm text-slate-400">Todavía no hay mensajes. ¡Enviá el primero!</p>
                )}
                {mensajes.map(m => {
                  const esMio = m.emisor_id === userId;
                  return (
                    <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          esMio
                            ? "rounded-br-sm bg-blue-600 text-white"
                            : "rounded-bl-sm bg-sky-50 text-blue-900"
                        }`}
                      >
                        {m.imagen_url && (
                          <img
                            src={`${BASE_URL}${m.imagen_url}`}
                            alt="imagen"
                            className="mb-1 max-w-full rounded-lg"
                            style={{ maxHeight: 220 }}
                          />
                        )}
                        {m.contenido.trim() && (
                          <p className="whitespace-pre-wrap wrap-break-word">{m.contenido}</p>
                        )}
                        <p className={`mt-1 flex items-center justify-end gap-1 text-xs ${
                          esMio ? "text-blue-200" : "text-slate-400"
                        }`}>
                          {formatHora(m.created_at)}
                          {esMio && (
                            m.leido === 1
                              ? <CheckCheck size={11} className="text-blue-300" />
                              : <Check size={11} className="text-blue-400 opacity-60" />
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {hasPermiso("mensajes", "crear") && (
                <div className="border-t border-sky-100 px-4 py-3">
                {errorEnvio && <p className="mb-2 text-xs text-red-500">{errorEnvio}</p>}
                {previewUrl && (
                  <div className="relative mb-2 inline-block">
                    <img src={previewUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-sky-200" />
                    <button
                      onClick={quitarImagen}
                      className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar imagen"
                    className="flex items-center justify-center rounded-xl border border-sky-200 px-3 py-2 text-slate-400 hover:bg-sky-50 hover:text-blue-600 transition-colors"
                  >
                    <Paperclip size={16} />
                  </button>
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={imagenPendiente ? "Agregá un texto (opcional)…" : "Escribí un mensaje… (Enter para enviar)"}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={() => void handleEnviar()}
                    disabled={enviando || (!texto.trim() && !imagenPendiente)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
