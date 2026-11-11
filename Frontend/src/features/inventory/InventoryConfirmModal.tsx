import React from 'react'
import { Button, Modal } from './ui'

interface InventoryConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const InventoryConfirmModal: React.FC<InventoryConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={isOpen}
    onClose={() => !isLoading && onCancel()}
    title={title}
    size="sm"
    role="alertdialog"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={isLoading} data-autofocus>
          {cancelText}
        </Button>
        <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm} loading={isLoading}>
          {isLoading ? 'Working…' : confirmText}
        </Button>
      </>
    }
  >
    <p className="text-sm leading-relaxed text-[var(--inv-text-2)]">{message}</p>
  </Modal>
)

export default InventoryConfirmModal
