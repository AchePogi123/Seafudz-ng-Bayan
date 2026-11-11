import React, { useCallback, useEffect, useRef } from 'react'
import { Icon, IconButton, type IconName } from './ui'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
}

interface InventoryToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const DURATION = 4500

const ICONS: Record<ToastMessage['type'], IconName> = {
  success: 'check',
  error: 'alertCircle',
  warning: 'alert',
  info: 'info',
}

export const InventoryToast: React.FC<InventoryToastProps> = ({ toasts, onDismiss }) => (
  <div className="inv-scope inv-toasts" aria-live="polite" aria-relevant="additions">
    {toasts.map((toast) => (
      <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
)

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const remaining = useRef(DURATION)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onDismiss(toast.id), remaining.current)
  }, [onDismiss, toast.id])

  const pause = () => {
    if (timer.current) clearTimeout(timer.current)
    remaining.current -= Date.now() - startedAt.current
  }

  useEffect(() => {
    start()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [start])

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`inv-toast inv-toast--${toast.type}`}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <span className="inv-toast-icon">
        <Icon name={ICONS[toast.type]} className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="inv-toast-title">{toast.title}</p>
        {toast.description && <p className="inv-toast-desc">{toast.description}</p>}
      </div>
      <IconButton icon="close" label="Dismiss notification" onClick={() => onDismiss(toast.id)} className="-mr-1 -mt-1" />
      <span className="inv-toast-progress" style={{ animationDuration: `${DURATION}ms` }} aria-hidden="true" />
    </div>
  )
}

export default InventoryToast
