import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'

interface AdminExportTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

type PeriodOption = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
type ChannelOption = 'all' | 'pos' | 'online'

export const AdminExportTransactionsModal: React.FC<AdminExportTransactionsModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
}) => {
  const [period, setPeriod] = useState<PeriodOption>('all')
  const [channel, setChannel] = useState<ChannelOption>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [preview, setPreview] = useState<{
    totalRecords: number
    grossTotal: number
    earliestDate: string | null
    latestDate: string | null
  } | null>(null)

  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchPreview = useCallback(async () => {
    if (!isAdmin) return
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
      if (res.ok && data.success) {
        setPreview(data.data)
      } else {
        setPreview(null)
      }
    } catch {
      setPreview(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [isAdmin, period, channel, startDate, endDate])

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

  const handleDownloadExcel = async () => {
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

      const res = await fetch(`${API_BASE_URL}/admin/export/transactions/excel?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Export failed with status ${res.status}`)
      }

      // Extract filename from Content-Disposition header if available
      let filename = `seafudz_transactions_export_${new Date().toISOString().slice(0, 10)}.xlsx`
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
        message: err.message || 'Failed to download Excel transactions export.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen || !isAdmin) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 antialiased">
      <div
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform-gpu animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-emerald-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="export-modal-title" className="text-xl font-bold text-slate-900 tracking-tight">
                  Export Historical Transactions
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Excel (.xlsx)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Download human-readable financial ledgers, itemized dish breakdowns, and customer payment records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto overscroll-contain space-y-5 will-change-scroll">
          {/* Informational Callout */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">Reporting vs. Disaster Recovery Notice</p>
              <p className="text-amber-800 leading-relaxed font-normal">
                This export is designed for management auditing, tax reporting, and spreadsheet analysis in Microsoft Excel or Google Sheets. It includes 3 tabs: <strong>Transactions Ledger</strong>, <strong>Itemized Breakdown</strong>, and <strong>Executive Financial Summary</strong>.
              </p>
              <p className="text-amber-800 leading-relaxed font-normal">
                For complete database disaster recovery, use the <strong>Database Backups (.sql.gz)</strong> snapshots.
              </p>
            </div>
          </div>

          {/* Timeframe Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              1. Select Timeframe Scope
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'All Historical Records', val: 'all' },
                { label: 'Today', val: 'today' },
                { label: 'This Week (7 Days)', val: 'week' },
                { label: 'This Month', val: 'month' },
                { label: 'This Year', val: 'year' },
                { label: 'Custom Range...', val: 'custom' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setPeriod(opt.val as PeriodOption)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                    period === opt.val
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {period === 'custom' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="text-xs font-bold text-slate-800">Custom Date Range (Asia/Manila)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Channel Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              2. Channel Filter
            </label>
            <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
              {[
                { label: 'All Channels', val: 'all' },
                { label: 'POS In-Store (Walk-In)', val: 'pos' },
                { label: 'Online Delivery', val: 'online' },
              ].map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => setChannel(c.val as ChannelOption)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    channel === c.val
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Record Preview Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Matching Database Records</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {isLoadingPreview ? (
                  <span className="text-slate-400 text-sm font-normal">Calculating...</span>
                ) : (
                  <>
                    <span>{preview?.totalRecords ?? 0}</span>
                    <span className="text-xs font-normal text-slate-500 ml-1.5">
                      orders (₱{(preview?.grossTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-500">
              <span>Timezone: </span>
              <strong className="text-slate-700">Asia/Manila (UTC+8)</strong>
            </div>
          </div>

          {/* Notifications */}
          {notification && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex-1 font-medium">{notification.message}</div>
              <button type="button" onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadExcel()}
            disabled={isExporting || preview?.totalRecords === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Generating Excel Spreadsheet...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Excel Ledger (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminExportTransactionsModal
