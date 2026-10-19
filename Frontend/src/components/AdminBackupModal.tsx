import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'

export interface BackupRecord {
  filename: string
  sizeBytes: number
  formattedSize: string
  createdAt: string | null
  manilaFormatted: string
  isVerified: boolean
}

interface BackupSystemStatus {
  totalBackups: number
  retentionLimit: number
  storageBucket: string
  storagePrivate: boolean
  timezone: string
  nextScheduledTime: string
  activeEngine: string
}

interface AdminBackupModalProps {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
  onOpenExcelExport?: () => void
}

export const AdminBackupModal: React.FC<AdminBackupModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onOpenExcelExport,
}) => {
  const [activeTab, setActiveTab] = useState<'backups' | 'recovery'>('backups')
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [systemStatus, setSystemStatus] = useState<BackupSystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Pagination State (5 snapshots per page to prevent long scroll lag)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  const totalPages = Math.max(1, Math.ceil(backups.length / PAGE_SIZE))
  const paginatedBackups = backups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const startItem = backups.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const endItem = Math.min(currentPage * PAGE_SIZE, backups.length)

  const fetchBackups = useCallback(async () => {
    if (!isAdmin) return
    setIsLoading(true)
    setNotification(null)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/admin/backups`, {
        method: 'GET',
        headers,
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setBackups(data.data.backups || [])
        setSystemStatus({
          totalBackups: data.data.totalBackups ?? 0,
          retentionLimit: data.data.retentionLimit ?? 30,
          storageBucket: data.data.storageBucket || 'database-backups',
          storagePrivate: data.data.storagePrivate ?? true,
          timezone: data.data.timezone || 'Asia/Manila',
          nextScheduledTime: data.data.nextScheduledTime || '03:00 AM (Asia/Manila)',
          activeEngine: data.data.activeEngine || 'PostgreSQL Dumper',
        })
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Failed to retrieve backups list.',
        })
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error fetching backups.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1)
      void fetchBackups()
    }
  }, [isOpen, fetchBackups])

  // Lock body scroll to prevent background scroll fighting and compositor lag
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [isOpen])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCreating) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isCreating, onClose])

  const handleCreateManualBackup = async () => {
    if (isCreating || !isAdmin) return
    setIsCreating(true)
    setNotification(null)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/admin/backups/run`, {
        method: 'POST',
        headers,
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          message: `Backup ${data.data.filename} created, verified, and uploaded successfully! (${(data.data.sizeBytes / 1024).toFixed(1)} KB in ${data.data.durationSeconds}s)`,
        })
        await fetchBackups()
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Backup creation failed.',
        })
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error executing backup.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDownload = async (filename: string) => {
    if (downloadingFile || !isAdmin) return
    setDownloadingFile(filename)
    setNotification(null)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/admin/backups/download/${encodeURIComponent(filename)}`, {
        method: 'GET',
        headers,
      })

      const data = await res.json()
      if (res.ok && data.success && data.data?.signedUrl) {
        const a = document.createElement('a')
        a.href = data.data.signedUrl
        a.download = filename
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        setNotification({
          type: 'success',
          message: `Signed download URL generated for ${filename}. Download starting...`,
        })
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Failed to obtain download URL.',
        })
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error requesting download URL.',
      })
    } finally {
      setDownloadingFile(null)
    }
  }

  if (!isOpen || !isAdmin) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 antialiased">
      <div
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden transform-gpu animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="backup-modal-title" className="text-xl font-bold text-slate-900 tracking-tight">
                  Database Backups & Disaster Recovery
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                  PostgreSQL Snapshots
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                30-day automated rolling database snapshots stored in private Supabase Storage.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200/80 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('backups')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === 'backups'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Backup Archives & Actions ({backups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recovery')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'recovery'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Disaster Recovery Guide</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </button>
          </div>

          {onOpenExcelExport && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenExcelExport()
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer mb-2 hidden sm:inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Looking for readable Excel reports?</span>
            </button>
          )}
        </div>

        {/* Tab 1: Backup Archives & Actions */}
        {activeTab === 'backups' && (
          <div className="p-6 overflow-y-auto overscroll-contain space-y-6 will-change-scroll">
            {/* Status KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Daily Schedule</span>
                </div>
                <div className="text-base font-bold text-slate-900 mt-1">03:00 AM</div>
                <div className="text-[11px] text-slate-500">Asia/Manila time</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>Retention Limit</span>
                </div>
                <div className="text-base font-bold text-slate-900 mt-1">
                  {backups.length} / {systemStatus?.retentionLimit || 30}
                </div>
                <div className="text-[11px] text-slate-500">Rolling 30-day window</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Storage Privacy</span>
                </div>
                <div className="text-base font-bold text-emerald-700 mt-1">Private Bucket</div>
                <div className="text-[11px] text-slate-500">database-backups</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                  </svg>
                  <span>Backup Engine</span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1 truncate" title={systemStatus?.activeEngine}>
                  {systemStatus?.activeEngine || 'Active Engine'}
                </div>
                <div className="text-[11px] text-slate-500">Gzip-compressed .sql.gz</div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manual Database Snapshot</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate an immediate full PostgreSQL database backup and upload it to Supabase.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void fetchBackups()}
                  disabled={isLoading || isCreating}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh backup list"
                >
                  <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateManualBackup()}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Backing Up & Validating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Manual Backup Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Notifications / Alerts */}
            {notification && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-all ${
                  notification.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {notification.type === 'success' ? (
                  <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1 font-medium">{notification.message}</div>
                <button
                  type="button"
                  onClick={() => setNotification(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Backups Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stored Backup Snapshots</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ordered by newest first. Rolling retention automatically purges files older than 30 versions.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {backups.length} file{backups.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Backup Filename</th>
                      <th className="py-3 px-4">Creation Date (Manila)</th>
                      <th className="py-3 px-4 text-right">File Size</th>
                      <th className="py-3 px-4 text-center">Integrity</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                    {isLoading && backups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <div className="inline-flex items-center gap-2 text-orange-600 font-medium">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span>Loading database backups...</span>
                          </div>
                        </td>
                      </tr>
                    ) : backups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <div className="max-w-xs mx-auto space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <p className="font-semibold text-slate-700">No Backups Found</p>
                            <p className="text-[11px] text-slate-400">
                              No backup archives have been recorded in Supabase yet. Click &ldquo;Create Manual Backup Now&rdquo; above to generate your first snapshot.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedBackups.map((bk) => (
                        <tr key={bk.filename} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="truncate max-w-[190px] sm:max-w-xs" title={bk.filename}>{bk.filename}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                            {bk.manilaFormatted}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {bk.formattedSize}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Verified .sql.gz</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void handleDownload(bk.filename)}
                              disabled={downloadingFile === bk.filename}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-200 hover:border-orange-200 transition-colors cursor-pointer disabled:opacity-50"
                              title={`Download ${bk.filename}`}
                            >
                              {downloadingFile === bk.filename ? (
                                <svg className="animate-spin w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              )}
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              {backups.length > 0 && (
                <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 font-medium">
                    Showing <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> of{" "}
                    <span className="font-semibold text-slate-800">{backups.length}</span> backup snapshot{backups.length === 1 ? "" : "s"}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Prev</span>
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={"page-" + pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLoading}
                          className={"min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer " + (
                            currentPage === pageNum
                              ? "bg-orange-500 text-white shadow-2xs"
                              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                          )}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages || isLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <span>Next</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Disaster Recovery Guide */}
        {activeTab === 'recovery' && (
          <div className="p-6 overflow-y-auto overscroll-contain space-y-5 text-xs text-slate-700 will-change-scroll">
            {/* Safety Warning */}
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-red-950 text-sm">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Critical Safety Precaution: Never Overwrite Live Production</span>
              </div>
              <p className="leading-relaxed font-normal">
                Database backups (<code>.sql.gz</code>) contain raw SQL drop and recreate statements. <strong>Never</strong> restore a backup directly over the live production database while transactions are active.
              </p>
              <p className="leading-relaxed font-normal">
                Always restore into a <strong>separate recovery or test database</strong> first, verify the historical records, and selectively migrate missing data.
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">1</span>
                  <span>Decompress the Downloaded Archive</span>
                </div>
                <p className="text-slate-600">
                  After downloading a backup file from the archives list, decompress the gzip container:
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`gzip -d seafudz_backup_YYYY-MM-DD_HHmmss.sql.gz`}
                </pre>
                <p className="text-[11px] text-slate-500">
                  This generates the uncompressed <code>seafudz_backup_YYYY-MM-DD_HHmmss.sql</code> database script.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">2</span>
                  <span>Create an Isolated Recovery Database</span>
                </div>
                <p className="text-slate-600">
                  Create a separate recovery database so production data remains 100% unaffected:
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`# PostgreSQL CLI:
createdb -h localhost -p 5432 -U postgres seafudz_recovery_db

# Or on local Docker:
docker exec -it seafudz_postgres createdb -U postgres seafudz_recovery_db`}
                </pre>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">3</span>
                  <span>Execute Restoration Into the Recovery Database</span>
                </div>
                <p className="text-slate-600">
                  Feed the SQL script into your recovery database using standard PostgreSQL tools:
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`# PostgreSQL CLI:
psql -h localhost -p 5432 -U postgres -d seafudz_recovery_db -f seafudz_backup_YYYY-MM-DD_HHmmss.sql

# Or on local Docker:
docker exec -i seafudz_postgres psql -U postgres -d seafudz_recovery_db < seafudz_backup_YYYY-MM-DD_HHmmss.sql`}
                </pre>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">4</span>
                  <span>Inspect & Audit Recovered Data</span>
                </div>
                <p className="text-slate-600">
                  Connect to <code>seafudz_recovery_db</code> and verify that transaction records match expectations:
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
{`SELECT count(*) FROM orders;
SELECT count(*) FROM order_items;
SELECT count(*) FROM payments;`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Security: Protected with short-lived 60-second HMAC signed URLs.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminBackupModal
