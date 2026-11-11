import React, { useState, useMemo } from 'react'
import type { Supplier, IngredientCategory } from './inventoryTypes'
import { FOOD_CATEGORIES, PACKAGING_CATEGORIES } from './inventoryTypes'
import InventoryConfirmModal from './InventoryConfirmModal'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Modal,
  Pagination,
  RowMenu,
  SearchInput,
  SectionHeader,
  Segmented,
  Toolbar,
  fieldAria,
} from './ui'

interface SuppliersTabProps {
  suppliers: Supplier[]
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void
  onEditSupplier: (supplier: Supplier) => void
  onDeleteSupplier: (id: string) => void
}

const PAGE_SIZE = 10

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
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginatedSuppliers = filteredSuppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeCount = suppliers.filter((s) => s.status === 'ACTIVE').length

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
    if (!name.trim()) errors.name = 'Enter the supplier or company name.'
    if (!contactPerson.trim()) errors.contactPerson = 'Enter a contact person.'
    if (!contactNumber.trim()) errors.contactNumber = 'Enter a phone or mobile number.'
    else if (!/^[+\d][\d\s()-]{6,}$/.test(contactNumber.trim()))
      errors.contactNumber = 'Use digits only, e.g. 0917 123 4567.'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = 'Enter a valid email address, or leave it empty.'
    if (leadTimeDays !== '' && Number(leadTimeDays) < 1) errors.leadTime = 'Lead time must be at least 1 day.'
    if (!address.trim()) errors.address = 'Enter the business or warehouse address.'
    setFormErrors(errors)
    const first = Object.keys(errors)[0]
    if (first) document.getElementById(`sup-${first}`)?.focus()
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

  const closeForm = () => {
    setIsAddModalOpen(false)
    setEditingSupplier(null)
  }

  const deletingSupplier = suppliers.find((s) => s.id === deletingSupplierId)

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Suppliers"
        description={`${activeCount} active of ${suppliers.length} vendors for seafood, produce and packaging.`}
        actions={
          <Button variant="primary" icon="plus" onClick={handleOpenAddModal}>
            Add supplier
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput
            label="Search suppliers"
            placeholder="Search by name, contact, phone or address"
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v)
              setCurrentPage(1)
            }}
          />
          <Segmented
            label="Supplier status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setCurrentPage(1)
            }}
            options={[
              { value: 'ALL', label: 'All', count: suppliers.length },
              { value: 'ACTIVE', label: 'Active', count: activeCount },
              { value: 'INACTIVE', label: 'Inactive', count: suppliers.length - activeCount },
            ]}
          />
        </Toolbar>

        {paginatedSuppliers.length === 0 ? (
          suppliers.length === 0 ? (
            <EmptyState
              icon="building"
              title="No suppliers yet"
              description="Add the vendors you buy from to use them on purchase orders and track delivery lead times."
              action={
                <Button variant="primary" icon="plus" onClick={handleOpenAddModal}>
                  Add supplier
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="No matching suppliers"
              description="Try a different search term or status."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('ALL')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col" className="hidden md:table-cell">Contact</th>
                  <th scope="col" className="hidden lg:table-cell">Supplies</th>
                  <th scope="col" className="is-num hidden sm:table-cell">Lead time</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[300px]">
                      <button type="button" className="inv-row-link block max-w-full truncate" onClick={() => handleOpenEditModal(s)}>
                        {s.name}
                      </button>
                      <div className="inv-cell-secondary truncate" title={s.address}>
                        {s.address}
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="text-[var(--inv-text)]">{s.contactPerson}</div>
                      <div className="inv-cell-secondary">
                        <a className="hover:underline" href={`tel:${s.contactNumber.replace(/\s/g, '')}`}>
                          {s.contactNumber}
                        </a>
                        {s.email && <> · {s.email}</>}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {s.categoriesSupplied && s.categoriesSupplied.length > 0 ? (
                          <>
                            {s.categoriesSupplied.slice(0, 2).map((cat) => (
                              <Badge key={cat}>{cat}</Badge>
                            ))}
                            {s.categoriesSupplied.length > 2 && (
                              <Badge title={s.categoriesSupplied.slice(2).join(', ')}>
                                +{s.categoriesSupplied.length - 2}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-[13px] text-[var(--inv-text-3)]">General</span>
                        )}
                      </div>
                    </td>
                    <td className="is-num hidden sm:table-cell">
                      {s.leadTimeDays ? `${s.leadTimeDays} ${s.leadTimeDays === 1 ? 'day' : 'days'}` : '1–2 days'}
                    </td>
                    <td>
                      <Badge tone={s.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                        {s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="is-actions">
                      <RowMenu
                        label={`Actions for ${s.name}`}
                        items={[
                          { label: 'Edit supplier', icon: 'edit', onSelect: () => handleOpenEditModal(s) },
                          {
                            label: s.status === 'ACTIVE' ? 'Mark inactive' : 'Mark active',
                            icon: 'refresh',
                            onSelect: () => onEditSupplier({ ...s, status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
                          },
                          {
                            label: 'Delete supplier',
                            icon: 'trash',
                            danger: true,
                            separatorBefore: true,
                            onSelect: () => setDeletingSupplierId(s.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filteredSuppliers.length}
          onChange={setCurrentPage}
          noun="suppliers"
        />
      </Card>

      <Modal
        open={isAddModalOpen || Boolean(editingSupplier)}
        onClose={closeForm}
        size="lg"
        title={editingSupplier ? `Edit ${editingSupplier.name}` : 'Add supplier'}
        description="Contact details, what they supply, and delivery terms."
        onSubmit={handleSubmit}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingSupplier ? 'Save changes' : 'Add supplier'}
            </Button>
          </>
        }
      >
        <div className="inv-form-section space-y-4">
          <p className="inv-form-section-title">Company</p>
          <Field label="Supplier name" htmlFor="sup-name" required error={formErrors.name}>
            <input
              {...fieldAria('sup-name', formErrors.name)}
              type="text"
              className="inv-input"
              placeholder="e.g. Navotas Premier Seafood Wholesale"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Business or warehouse address" htmlFor="sup-address" required error={formErrors.address}>
            <textarea
              {...fieldAria('sup-address', formErrors.address)}
              rows={2}
              className="inv-textarea"
              placeholder="e.g. Stall 14 Fish Port Complex, North Bay Blvd, Navotas City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
        </div>

        <div className="inv-form-section">
          <p className="inv-form-section-title">Contact</p>
          <div className="inv-grid-2">
            <Field label="Contact person" htmlFor="sup-contactPerson" required error={formErrors.contactPerson}>
              <input
                {...fieldAria('sup-contactPerson', formErrors.contactPerson)}
                type="text"
                className="inv-input"
                placeholder="e.g. Roberto Gomez"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </Field>
            <Field label="Phone or mobile" htmlFor="sup-contactNumber" required error={formErrors.contactNumber}>
              <input
                {...fieldAria('sup-contactNumber', formErrors.contactNumber)}
                type="tel"
                inputMode="tel"
                className="inv-input"
                placeholder="0917 123 4567"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="sup-email" optional error={formErrors.email}>
              <input
                {...fieldAria('sup-email', formErrors.email)}
                type="email"
                className="inv-input"
                placeholder="orders@vendor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="inv-form-section space-y-4">
          <p className="inv-form-section-title">Supply and terms</p>
          <div>
            <p className="inv-label mb-2" id="sup-cats-label">
              Categories supplied <span className="inv-optional">Optional</span>
            </p>
            <div className="space-y-3" role="group" aria-labelledby="sup-cats-label">
              {(
                [
                  { label: 'Food', cats: FOOD_CATEGORIES },
                  { label: 'Packaging', cats: PACKAGING_CATEGORIES },
                ] as Array<{ label: string; cats: IngredientCategory[] }>
              ).map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[13px] text-[var(--inv-text-3)]">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.cats.map((cat) => {
                      const isSelected = selectedCategories.includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          className="inv-chip"
                          aria-pressed={isSelected}
                          onClick={() => toggleCategory(cat)}
                        >
                          {isSelected && <Icon name="check" strokeWidth={2.4} />}
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="inv-grid-2">
            <Field label="Lead time" htmlFor="sup-leadTime" error={formErrors.leadTime} hint="Days from order to delivery.">
              <div className="inv-input-group">
                <input
                  {...fieldAria('sup-leadTime', formErrors.leadTime, true)}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  className="inv-input"
                  placeholder="2"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="inv-input-suffix">days</span>
              </div>
            </Field>
            <Field label="Status" htmlFor="sup-status">
              <select
                id="sup-status"
                className="inv-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Terms and notes" htmlFor="sup-notes" optional>
            <input
              id="sup-notes"
              type="text"
              className="inv-input"
              placeholder="e.g. Net 15, minimum ₱5,000 order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <InventoryConfirmModal
        isOpen={Boolean(deletingSupplierId)}
        title="Delete this supplier?"
        message={`${deletingSupplier?.name ?? 'This supplier'} will be removed from the directory. Past purchase orders keep the supplier name. To stop using them without deleting, mark them inactive instead.`}
        confirmText="Delete supplier"
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
