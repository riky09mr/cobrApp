"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ["/", "/login", "/register"];

// Permisos requeridos por ruta. Si una ruta no aparece aquí, cualquier
// usuario autenticado puede accederla.
const ROUTE_PERMISOS: Record<string, { modulo: string; accion: string }> = {
  "/empresas": { modulo: "empresas", accion: "ver" },
  "/importar": { modulo: "importar", accion: "ver" },
  "/importar/lotes": { modulo: "importar", accion: "ver" },
  "/zonas": { modulo: "zonas", accion: "ver" },
  "/clientes": { modulo: "clientes", accion: "ver" },
  "/configuracion-cobranzas": { modulo: "configuracion", accion: "ver" },
  "/configuracion-intereses": { modulo: "configuracion", accion: "ver" },
  "/cobranzas": { modulo: "cobranzas", accion: "ver" },
  "/gestiones": { modulo: "gestiones", accion: "ver" },
  "/reportes": { modulo: "reportes", accion: "ver" },
  "/medios-pago": { modulo: "medios_pago", accion: "ver" },
  "/descansos": { modulo: "descansos", accion: "ver" },
  "/horarios": { modulo: "horarios", accion: "ver" },
  "/mensajes": { modulo: "mensajes", accion: "ver" },
  "/usuarios": { modulo: "usuarios", accion: "ver" },
};

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("cobrapp_token");

    // Sin token → login
    if (!token && !PUBLIC_ROUTES.includes(pathname)) {
      router.push("/login");
      return;
    }

    // Con token → verificar si el usuario tiene el permiso para esta ruta
    if (token) {
      try {
        const user = JSON.parse(localStorage.getItem("cobrapp_user") || "{}") as {
          rol?: string;
          permisos?: string[];
        };
        const rol = user.rol ?? "";
        const permisos = Array.isArray(user.permisos) ? user.permisos : [];
        const required = ROUTE_PERMISOS[pathname];

        // ADMIN siempre tiene acceso total
        if (rol === "ADMIN") {
          return;
        }

        if (required && !permisos.includes(`${required.modulo}.${required.accion}`)) {
          toast.error("No tenés permisos para acceder a esa sección.");
          router.replace("/dashboard");
        }
      } catch {
        router.push("/login");
      }
    }
  }, [pathname, router]);
}
