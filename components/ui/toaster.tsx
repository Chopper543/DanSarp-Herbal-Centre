"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToasterProps {
  children?: ReactNode;
}

export function Toaster({ children }: ToasterProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...newToast, id }]);
    
    const duration = newToast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 max-w-md w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              rounded-lg border p-4 shadow-lg backdrop-blur-sm
              ${
                toast.variant === "error"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : toast.variant === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : toast.variant === "warning"
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }
            `}
          >
            {toast.title && (
              <div className="font-semibold text-sm mb-1">{toast.title}</div>
            )}
            {toast.description && (
              <div className="text-sm opacity-90">{toast.description}</div>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within Toaster");
  }
  return context;
}
