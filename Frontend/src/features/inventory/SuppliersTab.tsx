import React, { useState, useMemo } from 'react'
import type { Supplier, IngredientCategory } from './inventoryTypes'
import { ALL_CATEGORIES } from './inventoryTypes'
import InventoryConfirmModal from './InventoryConfirmModal'

interface SuppliersTabProps {
  suppliers: Supplier[]
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void
  onEditSupplier: (supplier: Supplier) => void
  onDeleteSupplier: (id: string) => void
}

const CATEGORIES: IngredientCategory[] = ALL_CATEGORIES

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
}) => {
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<IngredientCategory[]>([])
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>(2)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contactNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [suppliers, searchQuery, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage) || 1
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredSuppliers.slice(start, start + itemsPerPage)
  }, [filteredSuppliers, currentPage])

  // Reset Form
  const resetForm = () => {
    setName('')
    setContactPerson('')
    setContactNumber('')
    setEmail('')
    setAddress('')
    setSelectedCategories([])
    setLeadTimeDays(2)
    setNotes('')
    setStatus('ACTIVE')
    setFormErrors({})
  }

  const handleOpenAddModal = () => {
    resetForm()
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (s: Supplier) => {
    setEditingSupplier(s)
    setName(s.name)
    setContactPerson(s.contactPerson)
    setContactNumber(s.contactNumber)
    setEmail(s.email)
    setAddress(s.address)
    setSelectedCategories(s.categoriesSupplied || [])
    setLeadTimeDays(s.leadTimeDays || 2)
    setNotes(s.notes || '')
    setStatus(s.status)
    setFormErrors({})
  }

  const toggleCategory = (cat: IngredientCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Supplier company name is required'
    if (!contactPerson.trim()) errors.contactPerson = 'Contact person name is required'
    if (!contactNumber.trim()) errors.contactNumber = 'Contact phone/mobile is required'
    if (!address.trim()) errors.address = 'Business address is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    if (editingSupplier) {
      onEditSupplier({
        ...editingSupplier,
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        address: address.trim(),
        categoriesSupplied: selectedCategories,
        leadTimeDays: Number(leadTimeDays) || 1,
        notes: notes.trim(),
        status,
      })
      setEditingSupplier(null)
    } else {
      onAddSupplier({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        address: address.trim(),
        categoriesSupplied: selectedCategories,
        leadTimeDays: Number(leadTimeDays) || 1,
        notes: notes.trim(),
        status,
      })
      setIsAddModalOpen(false)
    }
    resetForm()
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROLS & FILTER BAR */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Vendors & Supplier Directory</h2>
            <p className="text-xs text-slate-500">
              Manage commercial seafood dealers, packaging providers, and grocery distributors.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Supplier
          </button>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="relative sm:col-span-2">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by vendor name, representative, phone, or address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All Vendor Statuses ({suppliers.length})</option>
              <option value="ACTIVE">Active Partners</option>
              <option value="INACTIVE">Inactive / Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. SUPPLIERS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {paginatedSuppliers.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center flex flex-col items-center justify-center px-4">
            <div className="h-16 w-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Suppliers Registered</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {suppliers.length === 0
                ? 'Your vendor list is currently blank. Register your suppliers to track purchasing records and delivery lead times.'
                : 'No suppliers match your current search query.'}
            </p>
            {suppliers.length === 0 && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
              >
                + Register First Supplier
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Supplier Company</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone / Email</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Categories Supplied</th>
                  <th className="py-3 px-4">Lead Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>
                        <span>{s.name}</span>
                        {s.notes && <p className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{s.notes}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{s.contactPerson}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>
                        <span className="font-semibold">{s.contactNumber}</span>
                        {s.email && <p className="text-[10px] text-slate-400">{s.email}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[200px]" title={s.address}>
                      {s.address}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {s.categoriesSupplied && s.categoriesSupplied.length > 0 ? (
                          s.categoriesSupplied.slice(0, 2).map((cat) => (
                            <span key={cat} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                              {cat}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">General</span>
                        )}
                        {s.categoriesSupplied && s.categoriesSupplied.length > 2 && (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500">
                            +{s.categoriesSupplied.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {s.leadTimeDays ? `${s.leadTimeDays} days` : '1-2 days'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(s)}
                          className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Edit Supplier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSupplierId(s.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Supplier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredSuppliers.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold">
                {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)}
              </span>{' '}
              of <span className="font-bold">{filteredSuppliers.length}</span> suppliers
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. ADD / EDIT SUPPLIER MODAL */}
      {(isAddModalOpen || editingSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsAddModalOpen(false)
              setEditingSupplier(null)
            }}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSupplier ? 'Edit Supplier Details' : 'Register New Supplier'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Contact information and delivery terms</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false)
                  setEditingSupplier(null)
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Supplier Company Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Company / Vendor Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Navotas Premier Seafood Wholesale Corp."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                  }`}
                />
                {formErrors.name && <p className="mt-1 text-[11px] text-rose-500">{formErrors.name}</p>}
              </div>

              {/* Contact Person & Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Roberto Gomez"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                      formErrors.contactPerson ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                    }`}
                  />
                  {formErrors.contactPerson && <p className="mt-1 text-[11px] text-rose-500">{formErrors.contactPerson}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Contact Phone / Mobile <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0917 123 4567"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                      formErrors.contactNumber ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                    }`}
                  />
                  {formErrors.contactNumber && <p className="mt-1 text-[11px] text-rose-500">{formErrors.contactNumber}</p>}
                </div>
              </div>

              {/* Email & Lead Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="vendor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 2"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Business Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Business / Warehouse Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Stall 14 Fish Port Complex, North Bay Boulevard, Navotas City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    formErrors.address ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                  }`}
                />
                {formErrors.address && <p className="mt-1 text-[11px] text-rose-500">{formErrors.address}</p>}
              </div>

              {/* Categories Supplied */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Categories Supplied</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? `✓ ${cat}` : `+ ${cat}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  >
                    <option value="ACTIVE">Active Partner</option>
                    <option value="INACTIVE">Inactive / Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Terms / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Net 15, Minimum ₱5,000 order"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setEditingSupplier(null)
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 cursor-pointer"
                >
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. DELETE CONFIRMATION MODAL */}
      <InventoryConfirmModal
        isOpen={Boolean(deletingSupplierId)}
        title="Delete Supplier"
        message="Are you sure you want to remove this supplier? Purchase history linked to this vendor will be archived."
        confirmText="Delete Supplier"
        isDestructive
        onConfirm={() => {
          if (deletingSupplierId) {
            onDeleteSupplier(deletingSupplierId)
            setDeletingSupplierId(null)
          }
        }}
        onCancel={() => setDeletingSupplierId(null)}
      />
    </div>
  )
}
export default SuppliersTab

