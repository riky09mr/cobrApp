"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/api";
import { Bike, LogIn } from "lucide-react";

type AnimState = "idle" | "riding" | "crash";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anim, setAnim] = useState<AnimState>("idle");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError(null);
    setAnim("riding");

    try {
      const response = await authApi.login({ email, password });

      // Pequeña espera para mostrar la animación de la moto
      setTimeout(() => {
        if (response.debeCambiarPassword) {
          router.push("/cambiar-password");
        } else {
          router.push("/dashboard");
        }
      }, 600);
    } catch (requestError: unknown) {
      const fallback = "No se pudo iniciar sesión";

      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (
          requestError as {
            response?: { data?: { message?: string } };
          }
        ).response?.data?.message === "string"
          ? (
              requestError as {
                response: { data: { message: string } };
              }
            ).response.data.message
          : fallback;

      setAnim("crash");

      setTimeout(() => {
        setError(message);
        setAnim("idle");
        setLoading(false);
      }, 3100);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Imagen de fondo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-bg.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full select-none object-cover"
        draggable={false}
      />

      {/* Oscurecemos un poco más para mejorar la lectura (cambio a bg-black/20) */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Formulario */}
      <div className="relative z-10 w-full max-w-md">
        {/* Fondo blanco semitransparente para que los textos azules se lean bien */}
        <div className="rounded-2xl border-2 border-white/30 bg-white/70 px-8 py-9 backdrop-blur-sm">
          <form onSubmit={handleLogin}>
            {/* Encabezado */}
            <div className="mb-8 text-center">
              <Bike
                size={38}
                className="mx-auto mb-3 text-blue-700"
              />

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900">
                cobrApp
              </p>

              <h1 className="mt-2 text-2xl font-semibold text-blue-900">
                Iniciar sesión
              </h1>
            </div>

            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="mb-2 block text-base font-bold text-blue-800">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-blue-200 bg-white/80 px-4 py-3 text-blue-900 outline-none transition placeholder:text-blue-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="mb-2 block text-base font-bold text-blue-800">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-blue-200 bg-white/80 px-4 py-3 text-blue-900 outline-none transition placeholder:text-blue-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Error */}
            {error ? (
              <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {/* Botón con animación */}
            <div
              className="relative mt-6 overflow-hidden rounded-lg"
              style={{ isolation: "isolate" }}
            >
              {anim !== "idle" && (
                <div
                  className={`pointer-events-none absolute inset-y-0 z-20 flex items-center select-none ${
                    anim === "riding" ? "moto-ride" : "moto-crash"
                  }`}
                >
                  <Bike
                    aria-hidden="true"
                    size={36}
                    style={{
                      display: "inline-block",
                      transform: "scaleX(-1)",
                    }}
                    className="text-white"
                  />
                </div>
              )}

              <button
                className="w-full rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 py-2.5 text-sm font-medium text-white transition inline-flex items-center justify-center gap-1 hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                <LogIn size={14} />
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </div>

            {/* Registro */}
            <p className="mt-6 text-center text-sm text-blue-700">
              ¿Olvidaste tu contraseña?{" "}
              <Link
                href="/register"
                className="font-semibold text-cyan-600 underline underline-offset-4 transition hover:text-cyan-700"
              >
                Solicitar recuperación
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}