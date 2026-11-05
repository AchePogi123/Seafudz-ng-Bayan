import React, { useEffect } from 'react'

export interface NoticeModalProps {
  isOpen: boolean
  title?: string
  message: string
  buttonText?: string
  onClose: () => void
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  title = 'Notice',
  message,
  buttonText = 'Understood',
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-neutral-200 text-center animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Neutral Icon - No color */}
        <div className="w-11 h-11 mx-auto rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center border border-neutral-200/80 mb-3.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Modal Title */}
        <h3 className="text-base font-bold text-neutral-900 tracking-tight">
          {title}
        </h3>

        {/* Message Content */}
        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mt-2 font-normal">
          {message}
        </p>

        {/* Modern Minimal Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition cursor-pointer shadow-xs"
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

export default NoticeModal

