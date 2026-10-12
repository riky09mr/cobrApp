"use client";

import { User, Save, Key } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PanelShell from "@/components/PanelShell";
import { panelApi } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export default function Perfil() {
  useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    email: "",
  });
  const [meta, setMeta] = useState({ empresa: "", rol: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await panelApi.getPropioUsuario();
      setForm({
        nombre: u.nombre,
        apellido: u.apellido,
        cedula: u.cedula ?? "",
        telefono: u.telefono ?? "",
        email: u.email,
      });
      setMeta({ empresa: u.rol === "ADMIN" ? "Todas las empresas" : u.empresa, rol: u.rol });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 401) {
        localStorage.removeItem("cobrapp_token");
        localStorage.removeItem("cobrapp_user");
        router.push("/login");
      } else {
        setError("No se pudo cargar el perfil");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
      setError("Nombre, apellido y email son requeridos");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await panelApi.updatePerfil({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        cedula: form.cedula.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim(),
      });
      setSuccess(res.message ?? "Perfil actualizado");

      // Actualizar localStorage para que el navbar muestre el nombre actualizado
      const stored = localStorage.getItem("cobrapp_user");
      if (stored) {
        try {
          const u = JSON.parse(stored) as Record<string, unknown>;
          u.nombre = form.nombre.trim();
          u.apellido = form.apellido.trim();
          u.email = form.email.trim();
          localStorage.setItem("cobrapp_user", JSON.stringify(u));
        } catch {}
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const campo = (label: string, key: keyof typeof form, type = "text", required = false) => (
    <div>
      <label className="block text-xs font-medium text-blue-800 mb-1">
        {label}{required && " *"}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  );

  return (
    <PanelShell title="Mi perfil" description="Editá tus datos personales">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Datos de identidad (solo lectura) */}
        <section className="rounded-xl border border-sky-100 bg-sky-50/40 px-5 py-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100">
            <User size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">{meta.rol}</p>
            <p className="text-xs text-slate-500">{meta.empresa}</p>
          </div>
        </section>

        {/* Formulario */}  
        <section className="rounded-xl border border-sky-200 bg-white shadow-sm">
          <div className="border-b border-sky-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-blue-900">Datos personales</h2>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-sm text-blue-600">Cargando...</p>
          ) : (
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {campo("Nombre", "nombre", "text", true)}
                {campo("Apellido", "apellido", "text", true)}
              </div>
              {campo("Email", "email", "email", true)}
              <div className="grid grid-cols-2 gap-3">
                {campo("Cédula", "cedula")}
                {campo("Teléfono", "telefono")}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600 font-medium">{success}</p>}

              <button
                onClick={handleGuardar}
                disabled={saving}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}
        </section>

        {/* Cambiar contraseña */}
        <section className="rounded-xl border border-sky-200 bg-white shadow-sm px-5 py-4">
          <h2 className="mb-3 text-sm font-semibold text-blue-900">Seguridad</h2>
          <button
            onClick={() => router.push("/cambiar-password")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 py-2.5 text-sm font-medium text-blue-700 hover:bg-sky-50 transition-colors"
          >
            <Key size={15} /> Cambiar contraseña
          </button>
        </section>
      </div>
    </PanelShell>
  );
}
