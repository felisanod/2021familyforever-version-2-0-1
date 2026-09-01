import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<{ showToast: (message: string, kind?: ToastKind) => void } | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++
    setToasts(list => [...list, { id, kind, message }])
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-neu-sm animate-[toast-in_200ms_ease-out] ${
              toast.kind === 'success'
                ? 'bg-success-50 text-success border-success/20'
                : toast.kind === 'error'
                  ? 'bg-error-50 text-error border-error/20'
                  : 'bg-primary-50 text-primary border-primary/20'
            }`}
          >
            <span aria-hidden>{toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}</span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}