"use client";

import { AlertTriangle } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
};

const toneStyles = {
  danger: {
    iconBg: "bg-red-100 text-red-600",
    confirmBtn: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    iconBg: "bg-amber-100 text-amber-600",
    confirmBtn: "bg-amber-600 hover:bg-amber-700",
  },
  info: {
    iconBg: "bg-sky-100 text-sky-600",
    confirmBtn: "bg-sky-600 hover:bg-sky-700",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = toneStyles[tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${styles.iconBg}`}>
            <AlertTriangle size={22} />
          </span>
          <h3 className="text-base font-semibold text-blue-900">{title}</h3>
        </div>
        <p className="mt-4 text-sm text-blue-700">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-sky-300 bg-white py-2 text-sm font-medium text-blue-700 transition hover:bg-sky-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2 text-sm font-medium text-white transition ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
