import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { Button, Field, Modal, Notice, Segmented } from '../features/inventory/ui'
import '../features/inventory/admin-inventory.css'

export type PeriodOption = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
export type ChannelOption = 'all' | 'pos' | 'online'

interface AdminExportTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
  /** Timeframe the Sales Management page is currently filtered to. */
  defaultPeriod?: PeriodOption
  /** Channel the Sales Management page is currently filtered to. */
  defaultChannel?: ChannelOption
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  all: 'All Historical Records',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  custom: 'Custom Range',
}

export const AdminExportTransactionsModal: React.FC<AdminExportTransactionsModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  defaultPeriod = 'all',
  defaultChannel = 'all',
}) => {
  const [period, setPeriod] = useState<PeriodOption>(defaultPeriod)
  const [channel, setChannel] = useState<ChannelOption>(defaultChannel)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [preview, setPreview] = useState<{
    totalRecords: number
    grossTotal: number
    earliestDate: string | null
    latestDate: string | null
  } | null>(null)

  const [showScopeOverride, setShowScopeOverride] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const previewRequestRef = useRef(0)

  const fetchPreview = useCallback(async () => {
    if (!isAdmin) return
    const requestId = ++previewRequestRef.current
    setIsLoadingPreview(true)
    setNotification(null)

    try {
      const headers = await getAuthHeaders()
      const queryParams = new URLSearchParams()
      queryParams.append('period', period)
      queryParams.append('channel', channel)
      if (period === 'custom') {
        if (startDate) queryParams.append('startDate', startDate)
        if (endDate) queryParams.append('endDate', endDate)
      }

      const res = await fetch(`${API_BASE_URL}/admin/export/transactions/preview?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      })

      const data = await res.json()
      // A slower earlier request must not overwrite a newer one's result.
      if (requestId !== previewRequestRef.current) return
      if (res.ok && data.success) {
        setPreview(data.data)
      } else {
        setPreview(null)
      }
    } catch {
      if (requestId === previewRequestRef.current) setPreview(null)
    } finally {
      if (requestId === previewRequestRef.current) setIsLoadingPreview(false)
    }
  }, [isAdmin, period, channel, startDate, endDate])

  // Each time the dialog opens it adopts the page's current filter, so the
  // admin never has to re-pick a timeframe they already chose on the report.
  useEffect(() => {
    if (!isOpen) return
    setPeriod(defaultPeriod)
    setChannel(defaultChannel)
    setStartDate('')
    setEndDate('')
    setShowScopeOverride(false)
    setNotification(null)
  }, [isOpen, defaultPeriod, defaultChannel])

  useEffect(() => {
    if (isOpen) {
      void fetchPreview()
    }
  }, [isOpen, fetchPreview])

  // Lock body scroll when modal is open to eliminate background repaints & scroll jank
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isExporting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isExporting, onClose])

  const handleDownloadPdf = async () => {
    if (isExporting || !isAdmin) return
    setIsExporting(true)
    setNotification(null)

    try {
      const headers = await getAuthHeaders({}, { jsonContentType: false })
      const queryParams = new URLSearchParams()
      queryParams.append('period', period)
      queryParams.append('channel', channel)
      if (period === 'custom') {
        if (startDate) queryParams.append('startDate', startDate)
        if (endDate) queryParams.append('endDate', endDate)
      }

      const res = await fetch(`${API_BASE_URL}/admin/export/transactions/pdf?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Export failed with status ${res.status}`)
      }

      // Extract filename from Content-Disposition header if available
      let filename = `seafudz_transactions_export_${new Date().toISOString().slice(0, 10)}.pdf`
      const disposition = res.headers.get('content-disposition')
      if (disposition && disposition.includes('filename="')) {
        const match = disposition.match(/filename="(.+?)"/)
        if (match?.[1]) filename = match[1]
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setNotification({
        type: 'success',
        message: `Successfully downloaded ${filename} (${preview?.totalRecords ?? 'all'} records).`,
      })
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to download PDF transactions export.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const isOverridden = period !== defaultPeriod || channel !== defaultChannel

  const resetToReportScope = () => {
    setPeriod(defaultPeriod)
    setChannel(defaultChannel)
    setStartDate('')
    setEndDate('')
    setShowScopeOverride(false)
  }

  if (!isOpen || !isAdmin) return null

  const channelLabel =
    channel === 'pos' ? 'Walk-in' : channel === 'online' ? 'Delivery' : 'All channels'
  const periodLabel =
    period === 'custom'
      ? `${startDate || 'Earliest'} → ${endDate || 'Latest'}`
      : PERIOD_LABELS[period]

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Export transactions"
      description="Financial audit report with an executive summary, the transactions ledger and an itemised dish breakdown."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="download"
            loading={isExporting}
            disabled={isExporting || preview?.totalRecords === 0}
            onClick={() => void handleDownloadPdf()}
          >
            {isExporting ? 'Generating PDF…' : 'Download PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* What this export covers — taken from the report, not chosen again here. */}
        <div className="inv-scope-panel">
          <div className="inv-scope-row">
            <span className="inv-scope-term">Period</span>
            <span className="inv-scope-value">{periodLabel}</span>
          </div>
          <div className="inv-scope-row">
            <span className="inv-scope-term">Channel</span>
            <span className="inv-scope-value">{channelLabel}</span>
          </div>
          <div className="inv-scope-row">
            <span className="inv-scope-term">Records</span>
            <span className="inv-scope-value">
              {isLoadingPreview ? (
                'Counting…'
              ) : (
                <>
                  {(preview?.totalRecords ?? 0).toLocaleString()} orders
                  <span className="inv-scope-muted">
                    {' · ₱'}
                    {(preview?.grossTotal ?? 0).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </>
              )}
            </span>
          </div>
          <div className="inv-scope-row">
            <span className="inv-scope-term">Timezone</span>
            <span className="inv-scope-value inv-scope-muted">Asia/Manila (UTC+8)</span>
          </div>
        </div>

        {isOverridden ? (
          <button type="button" className="inv-link text-xs" onClick={resetToReportScope}>
            Use my sales report filter again
          </button>
        ) : (
          <button type="button" className="inv-link text-xs" onClick={() => setShowScopeOverride((v) => !v)}>
            {showScopeOverride ? 'Hide range options' : 'Export a different range'}
          </button>
        )}

        {(showScopeOverride || isOverridden) && (
          <div className="inv-form-section space-y-3">
            <Field label="Period">
              <div className="inv-choice-group" role="radiogroup" aria-label="Export period">
                {(
                  [
                    { label: 'All records', val: 'all' },
                    { label: 'Today', val: 'today' },
                    { label: 'This week', val: 'week' },
                    { label: 'This month', val: 'month' },
                    { label: 'This year', val: 'year' },
                    { label: 'Custom range', val: 'custom' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    role="radio"
                    aria-checked={period === opt.val}
                    onClick={() => setPeriod(opt.val as PeriodOption)}
                    className="inv-choice"
                  >
                    <span className="inv-choice-title">{opt.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            {period === 'custom' && (
              <div className="inv-grid-2">
                <Field label="Start date" htmlFor="export-start">
                  <input
                    id="export-start"
                    type="date"
                    className="inv-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="End date" htmlFor="export-end">
                  <input
                    id="export-end"
                    type="date"
                    className="inv-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <Field label="Channel">
              <Segmented
                options={[
                  { value: 'all', label: 'All channels' },
                  { value: 'pos', label: 'Walk-in' },
                  { value: 'online', label: 'Delivery' },
                ]}
                value={channel}
                onChange={(v) => setChannel(v as ChannelOption)}
                label="Channel"
                size="sm"
              />
            </Field>
          </div>
        )}

        <Notice tone="info">
          For full database disaster recovery use the <strong>Database backups</strong> snapshots — this PDF is a
          reporting document, not a restore point.
        </Notice>

        {notification && (
          <Notice tone={notification.type === 'success' ? 'success' : 'danger'}>{notification.message}</Notice>
        )}
      </div>
    </Modal>
  )
}

export default AdminExportTransactionsModal
