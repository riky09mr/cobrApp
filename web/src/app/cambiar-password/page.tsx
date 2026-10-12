"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { panelApi } from "@/services/api";

export default function CambiarPassword() {
  const router = useRouter();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Validaciones
    if (passwordNueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    if (passwordNueva !== passwordConfirm) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    try {
      await panelApi.changePassword({ passwordActual, passwordNueva });
      alert("Contraseña cambiada exitosamente");
      router.push("/dashboard");
    } catch (requestError: unknown) {
      const fallback = "No se pudo cambiar la contraseña";
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (requestError as { response: { data: { message: string } } }).response.data.message
          : fallback;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-8 shadow-lg"
      >
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold"><Lock size={14} className="inline mr-1" />Cambio de contraseña obligatorio</p>
          <p className="mt-1 text-xs">
            Por seguridad, debes cambiar tu contraseña antes de continuar.
          </p>
        </div>

        <h2 className="mb-6 text-center text-2xl font-bold text-blue-900">Cambiar Contraseña</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">
              Contraseña Actual *
            </label>
            <input
              type="password"
              placeholder="Contraseña temporal"
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              value={passwordActual}
              onChange={(event) => setPasswordActual(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">
              Nueva Contraseña *
            </label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              value={passwordNueva}
              onChange={(event) => setPasswordNueva(event.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">
              Confirmar Contraseña *
            </label>
            <input
              type="password"
              placeholder="Repetir nueva contraseña"
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 py-3 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
          >
            {loading ? "Cambiando..." : "Cambiar Contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
