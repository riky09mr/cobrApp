"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogIn, LayoutDashboard, UserPlus } from "lucide-react";

import api from "@/services/api";

export default function Home() {
  useEffect(() => {
    const testConnection = async (): Promise<void> => {
      try {
        const response = await api.get("/api/dashboard/summary");
        console.log("Respuesta del backend:", response.data);
      } catch (error) {
        console.error("Error conectando con el backend:", error);
      }
    };

    void testConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-sky-200 bg-white p-10 shadow-lg shadow-sky-100">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
            <span className="text-3xl font-bold text-white">C</span>
          </div>
        </div>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">cobrApp</p>
        <h1 className="mt-3 text-center text-4xl font-bold text-blue-900">Panel cobrApp funcionando</h1>
        <p className="mt-3 text-center text-blue-700">
          Sistema SaaS de gestión de cobranzas multiempresa listo con autenticación JWT y módulos funcionales.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-linear-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md shadow-cyan-500/30 transition hover:from-cyan-700 hover:to-blue-700 hover:shadow-lg inline-flex items-center gap-2"
          >
            <LogIn size={15} /> Ir a Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-sky-300 bg-sky-50 px-6 py-3 text-sm font-medium text-blue-700 transition hover:bg-sky-100 inline-flex items-center gap-2"
          >
            <UserPlus size={15} /> Ir a Registro
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-sky-300 bg-sky-50 px-6 py-3 text-sm font-medium text-blue-700 transition hover:bg-sky-100 inline-flex items-center gap-2"
          >
            <LayoutDashboard size={15} /> Ir al Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
