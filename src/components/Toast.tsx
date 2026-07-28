import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: string; type: ToastType; message: string }

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLE: Record<ToastType, { color: string; icon: string }> = {
  success: { color: '#22c55e', icon: '✓' },
  error: { color: '#ef4444', icon: '✕' },
  warning: { color: '#f59e0b', icon: '⚠' },
  info: { color: '#3b82f6', icon: 'ℹ' },
};

/**
 * Global toast system (UI polish pass). Real, reusable — every screen
 * currently shows errors as an inline div local to that component; this is
 * the shared infrastructure that replaces that pattern going forward.
 * Wired into a few real actions this pass, not a component left unused.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((toast) => toast.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'grid', gap: 8, zIndex: 1000 }}>
        {toasts.map((t) => {
          const style = TYPE_STYLE[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                padding: '10px 16px', borderRadius: 8, backgroundColor: theme.surface,
                border: `1px solid ${style.color}`, borderLeft: `4px solid ${style.color}`,
                color: theme.text, display: 'flex', alignItems: 'center', gap: 8,
                minWidth: 240, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: 13,
              }}
            >
              <span style={{ color: style.color }}>{style.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
