"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode, ElementType } from "react";
import {
  LayoutDashboard, Building2, Users, FileSpreadsheet,
  Banknote, Map, MapPin, User, Coffee, LogOut, Clock, ClipboardList, MessageSquare, CreditCard, BarChart3, Percent, CalendarDays, Upload, History, RefreshCw, UserCheck,
} from "lucide-react";
import { authApi } from "@/services/api";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

type PanelShellProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  Icon: ElementType;
  permiso?: { modulo: string; accion: string };
  children?: { href: string; label: string; Icon: ElementType; permiso?: { modulo: string; accion: string } }[];
};

type StoredProfile = {
  rol: string;
  nombre: string;
  apellido: string;
  empresaNombre: string | null;
  empresaLogo: string | null;
  permisos: string[];
};

const DEFAULT_PROFILE: StoredProfile = {
  rol: "COBRADOR",
  nombre: "",
  apellido: "",
  empresaNombre: null,
  empresaLogo: null,
  permisos: [],
};

let cachedProfileRaw = "";
let cachedProfileSnapshot: StoredProfile = DEFAULT_PROFILE;

const readProfile = (): StoredProfile => {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE;
  }

  try {
    const raw = localStorage.getItem("cobrapp_user") || "{}";
    if (raw === cachedProfileRaw) {
      return cachedProfileSnapshot;
    }

    const u = JSON.parse(raw);
    cachedProfileRaw = raw;
    cachedProfileSnapshot = {
      rol: u.rol ?? "COBRADOR",
      nombre: u.nombre ?? "",
      apellido: u.apellido ?? "",
      empresaNombre: u.empresa_nombre ?? null,
      empresaLogo: u.empresa_logo ?? null,
      permisos: Array.isArray(u.permisos) ? u.permisos : [],
    };
    return cachedProfileSnapshot;
  } catch {
    cachedProfileRaw = "";
    cachedProfileSnapshot = DEFAULT_PROFILE;
    return DEFAULT_PROFILE;
  }
};

const subscribeProfile = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};

// Todos los items de navegación con su permiso requerido.
// Se filtran según los permisos del usuario en el render.
const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",        Icon: LayoutDashboard },
  { href: "/empresas",   label: "Empresas",          Icon: Building2, permiso: { modulo: "empresas", accion: "ver" } },
  { href: "/reportes",   label: "Reportes",          Icon: BarChart3, permiso: { modulo: "reportes", accion: "ver" } },
  { href: "/configuracion-cobranzas", label: "Config. Cobranzas", Icon: Banknote, permiso: { modulo: "configuracion", accion: "ver" } },
  { href: "/configuracion-intereses", label: "Feriados",         Icon: CalendarDays, permiso: { modulo: "configuracion", accion: "ver" } },
  { href: "/clientes",   label: "Clientes",          Icon: Users, permiso: { modulo: "clientes", accion: "ver" } },
  {
    href: "/importar",
    label: "Importar Excel",
    Icon: FileSpreadsheet,
    permiso: { modulo: "importar", accion: "ver" },
    children: [
      { href: "/importar", label: "Importar Excel", Icon: Upload, permiso: { modulo: "importar", accion: "ver" } },
      { href: "/importar/lotes", label: "Lotes", Icon: History, permiso: { modulo: "importar", accion: "ver" } },
    ],
  },
  { href: "/cobranzas",  label: "Cobranzas",         Icon: Banknote, permiso: { modulo: "cobranzas", accion: "ver" } },
  // { href: "/notas-credito", label: "Notas de Crédito", Icon: FileText, permiso: { modulo: "cobranzas", accion: "editar" } },
  { href: "/gestiones",  label: "Gestiones",         Icon: ClipboardList, permiso: { modulo: "gestiones", accion: "ver" } },
  { href: "/mapa",       label: "Mapa de visitas",   Icon: MapPin, permiso: { modulo: "cobranzas", accion: "ver" } },
  { href: "/zonas",      label: "Zonas",             Icon: Map, permiso: { modulo: "zonas", accion: "ver" } },
  { href: "/asignaciones", label: "Asignaciones",    Icon: RefreshCw, permiso: { modulo: "zonas", accion: "ver" } },
  { href: "/cobradores",  label: "Cobradores",       Icon: UserCheck, permiso: { modulo: "cobranzas", accion: "ver" } },
  { href: "/descansos",  label: "Descansos",         Icon: Coffee, permiso: { modulo: "descansos", accion: "ver" } },
  { href: "/horarios",   label: "Horarios",          Icon: Clock, permiso: { modulo: "horarios", accion: "ver" } },
  { href: "/medios-pago", label: "Métodos de pago",  Icon: CreditCard, permiso: { modulo: "medios_pago", accion: "ver" } },
  { href: "/usuarios",   label: "Usuarios",          Icon: Users, permiso: { modulo: "usuarios", accion: "ver" } },
  { href: "/mensajes",   label: "Mensajes",          Icon: MessageSquare, permiso: { modulo: "mensajes", accion: "ver" } },
  { href: "/perfil",     label: "Mi perfil",         Icon: User },
];

export default function PanelShell({ title, description, children }: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, readProfile, () => DEFAULT_PROFILE);
  const userName = [profile.nombre, profile.apellido].filter(Boolean).join(" ");
  const userRol = profile.rol;
  const empresaNombre = profile.empresaNombre;
  const empresaLogo = profile.empresaLogo;

  // Filtrar items de navegación según permisos del usuario.
  // ADMIN siempre ve todo.
  const hasPermiso = (permiso?: { modulo: string; accion: string }) => {
    if (!permiso) return true;
    if (userRol === "ADMIN") return true;
    return profile.permisos.includes(`${permiso.modulo}.${permiso.accion}`);
  };

  const navItems = ALL_NAV_ITEMS
    .filter((item) => hasPermiso(item.permiso))
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => hasPermiso(c.permiso));
        return { ...item, children };
      }
      return item;
    })
    .filter((item) => !item.children || item.children.length > 0);

  // Cierra sesión automáticamente tras 1 hora de inactividad
  useInactivityLogout();

  const handleLogout = () => {
    authApi.logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-r border-sky-200 bg-white/80 p-6 backdrop-blur-sm md:block">
        <div className="mb-8">
          {userRol === "ADMIN" ? (
            <>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600">
                <span className="text-lg font-bold text-white">C</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                cobrApp
              </p>
              <h2 className="mt-2 text-lg font-bold text-blue-900">Panel Administrativo</h2>
            </>
          ) : (
            <>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 overflow-hidden">
                {empresaLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`http://localhost:5000${empresaLogo}`}
                    alt="Logo empresa"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-lg font-bold text-white">
                    {empresaNombre ? empresaNombre.charAt(0).toUpperCase() : "C"}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
                cobrApp
              </p>
              <h2 className="mt-2 text-lg font-bold text-blue-900 leading-tight">
                {empresaNombre ?? "Mi empresa"}
              </h2>
            </>
          )}
          {userName && <p className="mt-1 truncate text-xs text-blue-400">{userName}</p>}
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            if (item.children && item.children.length > 0) {
              const groupActive = item.children.some((c) => pathname === c.href);
              return (
                <div key={item.href} className="space-y-1">
                  <div
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      groupActive
                        ? "bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30"
                        : "text-blue-700 hover:bg-sky-100"
                    }`}
                  >
                    <item.Icon size={17} />
                    {item.label}
                  </div>
                  <div className="ml-4 space-y-1 border-l border-sky-200 pl-3">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition ${
                            isActive
                              ? "bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30"
                              : "text-blue-700 hover:bg-sky-100"
                          }`}
                        >
                          <child.Icon size={16} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30"
                    : "text-blue-700 hover:bg-sky-100"
                }`}
              >
                <item.Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-sky-50"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-sky-200 bg-white/80 px-6 py-4 backdrop-blur-sm md:px-10">
          <p className="text-sm text-cyan-600">Sistema de cobranzas multiempresa</p>
          <h1 className="text-2xl font-bold text-blue-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-blue-700">{description}</p> : null}
        </header>

        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

