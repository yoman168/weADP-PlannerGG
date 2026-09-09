'use client';

import { Check, AlertCircle, Info, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/components/ui';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
let listeners: Array<(toast: ToastItem) => void> = [];

/** Show a toast from anywhere — no provider needed. */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const toast: ToastItem = { id: ++toastId, message, type };
  for (const fn of listeners) fn(toast);
}

/** Hook version — returns the same function. */
export function useToast() {
  return showToast;
}

const ICON = { success: Check, error: AlertCircle, info: Info } as const;

/** Render this once in a client layout — it listens for showToast calls. */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const add = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 3000);
  }, []);

  useEffect(() => {
    listeners.push(add);
    return () => { listeners = listeners.filter((fn) => fn !== add); };
  }, [add]);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {toasts.map((toast) => {
        const Icon = ICON[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2.5 rounded-md border bg-background px-4 py-3 shadow-md duration-200"
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full',
                toast.type === 'success' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
                toast.type === 'error' && 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
                toast.type === 'info' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
              )}
            >
              <Icon className="size-3" />
            </span>
            <span className="text-sm">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/** Legacy — keep for backward compat but does nothing. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}<ToastContainer /></>;
}
