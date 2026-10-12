"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

const LAST_ACTIVITY_KEY = "cobrapp_last_activity";

function doLogout(router: ReturnType<typeof useRouter>) {
  localStorage.removeItem("cobrapp_token");
  localStorage.removeItem("cobrapp_user");
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  router.push("/login");
}

/**
 * Cierra sesión automáticamente después de `timeoutMs` milisegundos
 * sin actividad del usuario. Por defecto 60 minutos.
 *
 * Persiste el timestamp de última actividad en localStorage para que
 * funcione aunque el navegador se haya cerrado y vuelto a abrir.
 */
export function useInactivityLogout(timeoutMs = 60 * 60 * 1000) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ── Verificación al montar ──────────────────────────────────────
    // Si el usuario cerró el navegador/pestaña y regresa después de que
    // expiró el tiempo, el setTimeout nunca disparó. Revisamos el
    // timestamp guardado y cerramos sesión de inmediato si ya expiró.
    const saved = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (saved) {
      const elapsed = Date.now() - Number(saved);
      if (elapsed >= timeoutMs) {
        doLogout(router);
        return;
      }
    }

    const resetTimer = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doLogout(router), timeoutMs);
    };

    // Inicia el contador (usando el tiempo restante si ya había actividad)
    if (saved) {
      const elapsed = Date.now() - Number(saved);
      const remaining = timeoutMs - elapsed;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      timerRef.current = setTimeout(() => doLogout(router), remaining);
    } else {
      resetTimer();
    }

    // Reinicia el contador en cada evento de actividad
    INACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      INACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs]);
}
