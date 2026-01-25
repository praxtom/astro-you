import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Sparkles } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning" | "guru";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Toast Container Component
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// Individual Toast Component
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle className="text-green-400" size={20} />,
    error: <AlertCircle className="text-red-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
    warning: <AlertTriangle className="text-yellow-400" size={20} />,
    guru: <Sparkles className="text-violet-400" size={20} />,
  };

  const borderColors = {
    success: "border-green-500/30",
    error: "border-red-500/30",
    info: "border-blue-500/30",
    warning: "border-yellow-500/30",
    guru: "border-violet-500/30 bg-violet-500/5",
  };

  return (
    <div
      role="alert"
      className={`
        glass p-4 pr-10 rounded-xl border ${borderColors[toast.type]}
        animate-in slide-in-from-right-5 fade-in duration-300
        min-w-[280px]
      `}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div>
          <p className="font-sans font-semibold text-sm text-white">
            {toast.title}
          </p>
          {toast.message && (
            <p className="font-sans text-xs text-white/60 mt-1">
              {toast.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Convenience hooks
export function useSuccessToast() {
  const { addToast } = useToast();
  return (title: string, message?: string) =>
    addToast({ type: "success", title, message });
}

export function useErrorToast() {
  const { addToast } = useToast();
  return (title: string, message?: string) =>
    addToast({ type: "error", title, message });
}

export default ToastProvider;
