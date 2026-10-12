"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook para verificar permisos del usuario autenticado.
 *
 * Lee los permisos del usuario desde localStorage (`cobrapp_user.permisos`).
 * El backend ya calcula los permisos efectivos (rol + excepciones por usuario)
 * y los devuelve en el login.
 *
 * Uso:
 *   const { hasPermiso } = usePermisos();
 *   if (hasPermiso("clientes", "crear")) { ... }
 */

type PermisosStore = {
  permisos: string[];
};

const DEFAULT_PERMISOS: PermisosStore = { permisos: [] };

let cachedPermisosRaw = "";
let cachedPermisosSnapshot: PermisosStore = DEFAULT_PERMISOS;

const readPermisos = (): PermisosStore => {
  if (typeof window === "undefined") {
    return DEFAULT_PERMISOS;
  }

  try {
    const raw = localStorage.getItem("cobrapp_user") || "{}";
    if (raw === cachedPermisosRaw) {
      return cachedPermisosSnapshot;
    }

    const u = JSON.parse(raw);
    cachedPermisosRaw = raw;
    cachedPermisosSnapshot = {
      permisos: Array.isArray(u.permisos) ? u.permisos : [],
    };
    return cachedPermisosSnapshot;
  } catch {
    cachedPermisosRaw = "";
    cachedPermisosSnapshot = DEFAULT_PERMISOS;
    return DEFAULT_PERMISOS;
  }
};

const subscribePermisos = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};

export function usePermisos() {
  const store = useSyncExternalStore(subscribePermisos, readPermisos, () => DEFAULT_PERMISOS);

  const hasPermiso = (modulo: string, accion: string): boolean => {
    return store.permisos.includes(`${modulo}.${accion}`);
  };

  const hasAlgunPermiso = (modulo: string, acciones: string[]): boolean => {
    return acciones.some((accion) => store.permisos.includes(`${modulo}.${accion}`));
  };

  return { permisos: store.permisos, hasPermiso, hasAlgunPermiso };
}
