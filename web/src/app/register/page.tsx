"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { authApi } from "@/services/api";

export default function Register() {
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await authApi.register({ nombreEmpresa, email, password });
      console.log("Registro exitoso:", response);
      setMessage("Registro completado. Ya puedes iniciar sesión.");
      setNombreEmpresa("");
      setEmail("");
      setPassword("");
    } catch (requestError: unknown) {
      const fallback = "No se pudo completar el registro";
      const backendMessage =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (requestError as { response: { data: { message: string } } }).response.data.message
          : fallback;
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        className="w-full max-w-md rounded-2xl border border-sky-200 bg-white p-8 shadow-lg shadow-sky-100"
        onSubmit={handleRegister}
      >
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-cyan-500 to-blue-600">
            <span className="text-xl font-bold text-white">C</span>
          </div>
        </div>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">
          cobrApp
        </p>
        <h2 className="mb-6 mt-2 text-center text-2xl font-bold text-blue-900">Registro empresa</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">Nombre de la empresa</label>
            <input
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              placeholder="Mi Empresa S.A."
              value={nombreEmpresa}
              onChange={(event) => setNombreEmpresa(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">Correo electrónico</label>
            <input
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              placeholder="empresa@email.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-blue-800">Contraseña</label>
            <input
              className="w-full rounded-lg border border-sky-300 bg-sky-50/50 px-4 py-2.5 text-blue-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          className="mt-6 w-full rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 font-medium text-white shadow-md shadow-cyan-500/30 transition hover:from-cyan-700 hover:to-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Registrando..." : "Registrarse"}
        </button>

        <p className="mt-6 text-center text-sm text-blue-700">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-cyan-600 hover:text-cyan-700">
            Inicia sesión aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
