import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import {
    Badge,
    Button,
    Card,
    CardHeader,
    EmptyState,
    Field,
    Icon,
    Modal,
    Notice,
    Pagination,
    RowMenu,
    SearchInput,
    Segmented,
    Toolbar,
    type BadgeTone,
    type RowMenuItem,
} from './inventory/ui'
import './inventory/admin-inventory.css'

type StatusFilter = 'all' | 'active' | 'pending' | 'inactive'

const STATUS_META: Record<User['status'], { label: string; tone: BadgeTone }> = {
    active: { label: 'Active', tone: 'success' },
    pending: { label: 'Pending activation', tone: 'warning' },
    inactive: { label: 'Inactive', tone: 'neutral' },
}

interface User {
    id: string
    db_id?: string
    name: string
    username: string
    contact: string
    email: string
    role: string
    status: 'active' | 'inactive' | 'pending'
}

const UserManagement = () => {
    const navigate = useNavigate()
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [users, setUsers] = useState<User[]>([])
    const [idCounter, setIdCounter] = useState(101)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUsernameCustom, setIsUsernameCustom] = useState(false)
    const [createError, setCreateError] = useState('')
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [resendingUserId, setResendingUserId] = useState<string | null>(null)

    // Edit modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editError, setEditError] = useState('')
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editFormData, setEditFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        confirmPassword: '',
        showPassword: false,
        showConfirmPassword: false,
    })

    // Deactivation confirmation modal state
    const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null)

    // Create user form data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        contact: '',
        email: '',
        role: '',
    })

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const headers = await getAuthHeaders()
                const res = await fetch(`${API_BASE_URL}/users`, { headers })
                const data = await res.json()
                if (data.success && Array.isArray(data.data)) {
                    setUsers(data.data)
                    setIdCounter(101 + data.data.length)
                }
            } catch (err) {
                console.warn('Could not load users from backend DB:', err)
            }
        }
        void fetchUsers()
    }, [])

    const nextUserId = `U${String(idCounter).padStart(3, '0')}`

    const generateDefaultUsername = (firstName: string, lastName: string) => {
        const cleanFirst = firstName.trim()
        const cleanLast = lastName.trim()
        if (!cleanFirst && !cleanLast) return ''
        const firstInitial = cleanFirst ? cleanFirst.charAt(0).toUpperCase() : ''
        const generated = firstInitial && cleanLast ? `${firstInitial}.${cleanLast}` : firstInitial || cleanLast
        const safeUsername = generated
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9._-]+/g, '.')
            .slice(0, 32)
        return safeUsername.length >= 3 ? safeUsername : 'staff.user'
    }

    const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setFormData((prev) => {
            const nextState = { ...prev, firstName: value }
            if (!isUsernameCustom) {
                nextState.username = generateDefaultUsername(value, prev.lastName)
            }
            return nextState
        })
    }

    const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setFormData((prev) => {
            const nextState = { ...prev, lastName: value }
            if (!isUsernameCustom) {
                nextState.username = generateDefaultUsername(prev.firstName, value)
            }
            return nextState
        })
    }

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setIsUsernameCustom(true)
        setFormData((prev) => ({ ...prev, username: value }))
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleOpenModal = () => setIsModalOpen(true)

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setIsUsernameCustom(false)
        setCreateError('')
        setFormData({
            firstName: '',
            lastName: '',
            username: '',
            contact: '',
            email: '',
            role: '',
        })
    }

    // Open Edit Modal
    const handleOpenEditModal = (user: User) => {
        setEditingUser(user)
        const nameParts = (user.name || '').trim().split(/\s+/)
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || ''
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

        setEditFormData({
            firstName,
            lastName,
            username: user.username,
            password: '',
            confirmPassword: '',
            showPassword: false,
            showConfirmPassword: false,
        })
        setEditError('')
        setIsEditModalOpen(true)
    }

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false)
        setEditingUser(null)
        setEditError('')
    }

    // Submit Edit User
    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingUser) return
        setEditError('')
        const cleanFirst = editFormData.firstName.trim()
        const cleanLast = editFormData.lastName.trim()
        if (!cleanFirst || !cleanLast) {
            setEditError('First Name and Last Name are required.')
            return
        }

        const cleanPassword = editFormData.password.trim()
        const cleanConfirm = editFormData.confirmPassword.trim()

        if (cleanPassword || cleanConfirm) {
            if (cleanPassword !== cleanConfirm) {
                setEditError('New password and confirm password do not match.')
                return
            }
            if (cleanPassword.length < 6) {
                setEditError('New password must be at least 6 characters.')
                return
            }
            if (cleanPassword.length > 128) {
                setEditError('New password cannot exceed 128 characters.')
                return
            }
        }

        const fullName = `${cleanFirst} ${cleanLast}`
        const updatedUser: User = {
            ...editingUser,
            name: fullName,
            username: editFormData.username.trim() || editingUser.username,
        }

        const identifier = editingUser.db_id || editingUser.username || editingUser.email || editingUser.id

        // Persist edits to PostgreSQL database via API
        try {
            const headers = await getAuthHeaders()
            const payload: { name: string; username: string; password?: string } = {
                name: fullName,
                username: editFormData.username.trim(),
            }
            if (cleanPassword) {
                payload.password = cleanPassword
            }

            const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to update staff user.')
            }

            const saved = data.data || updatedUser
            setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? {
                ...u,
                name: saved.name || updatedUser.name,
                username: saved.username || updatedUser.username,
                role: saved.role || updatedUser.role,
                status: saved.status || (cleanPassword ? 'active' : u.status),
            } : u)))

            setActionMessage({
                type: 'success',
                text: cleanPassword
                    ? `Staff ${fullName} updated and new password set successfully.`
                    : `Staff ${fullName} updated successfully.`,
            })
            handleCloseEditModal()
        } catch (err) {
            console.warn('Failed to update user in backend database:', err)
            const errorMsg = err instanceof Error ? err.message : 'Failed to update user in database.'
            setEditError(errorMsg)
            setActionMessage({
                type: 'error',
                text: errorMsg,
            })
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError('')
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.role || !formData.email.trim()) {
            setCreateError('First name, last name, email, and role are required.')
            return
        }

        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`
        const finalUsername =
            formData.username.trim() || generateDefaultUsername(formData.firstName, formData.lastName)

        setIsCreating(true)
        try {
            const headers = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    id: nextUserId,
                    name: fullName,
                    username: finalUsername,
                    contact: formData.contact.trim(),
                    email: formData.email.trim(),
                    role: formData.role,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success || !data.data) {
                throw new Error(data.message || 'Could not create the staff account.')
            }
            const saved = data.data
            setUsers((prev) => [...prev, {
                id: saved.id || nextUserId,
                db_id: saved.db_id,
                name: saved.name || fullName,
                username: saved.username || finalUsername,
                contact: saved.contact || '-',
                email: saved.email || formData.email.trim(),
                role: saved.role || formData.role,
                status: 'pending',
            }])
            setActionMessage({
                type: data.activationEmailSent ? 'success' : 'error',
                text: data.message || 'Staff account created pending activation.',
            })
            setIdCounter((prev) => prev + 1)
            handleCloseModal()
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'Could not create the staff account.')
        } finally {
            setIsCreating(false)
        }
    }

    const toggleStatus = async (id: string) => {
        const target = users.find((u) => u.id === id)
        if (!target || target.status === 'pending') return
        const nextStatus = target.status === 'active' ? 'inactive' : 'active'
        try {
            const headers = await getAuthHeaders()
            const identifier = target.db_id || target.username || target.email || id
            const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}/toggle-status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: nextStatus }),
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not update account status.')
            setUsers((prev) => prev.map((user) => user.id === id ? { ...user, status: nextStatus } : user))
        } catch (error) {
            setActionMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Could not update account status.',
            })
        }
    }

    const handleDeactivateClick = (user: User) => {
        if (user.status === 'active') {
            setDeactivatingUser(user)
        } else if (user.status === 'inactive') {
            void toggleStatus(user.id)
        }
    }

    const handleConfirmDeactivate = async () => {
        if (!deactivatingUser) return
        await toggleStatus(deactivatingUser.id)
        setDeactivatingUser(null)
    }

    const handleResendActivation = async (user: User) => {
        const identifier = user.db_id || user.id
        setResendingUserId(user.id)
        setActionMessage(null)
        try {
            const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}/resend-activation`, {
                method: 'POST',
                headers: await getAuthHeaders(),
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not resend activation email.')
            setActionMessage({ type: 'success', text: payload.message || `Activation email sent to ${user.email}.` })
        } catch (error) {
            setActionMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Could not resend activation email.',
            })
        } finally {
            setResendingUserId(null)
        }
    }

    const handleDeletePendingUser = async (user: User) => {
        if (user.status !== 'pending') return
        if (!window.confirm(`Delete the pending account for ${user.name}? Its activation link will stop working.`)) return

        setActionMessage(null)
        try {
            const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(user.db_id || user.id)}`, {
                method: 'DELETE',
                headers: await getAuthHeaders(),
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not delete pending account.')
            setUsers((prev) => prev.filter((entry) => entry.id !== user.id))
            setActionMessage({ type: 'success', text: `Pending account for ${user.name} was deleted.` })
        } catch (error) {
            setActionMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Could not delete pending account.',
            })
        }
    }
    const q = searchTerm.trim().toLowerCase()
    const matchesSearch = (u: User) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)

    const searchedUsers = users.filter(matchesSearch)
    const filteredUsers = searchedUsers.filter((u) => statusFilter === 'all' || u.status === statusFilter)

    const counts = {
        all: searchedUsers.length,
        active: searchedUsers.filter((u) => u.status === 'active').length,
        pending: searchedUsers.filter((u) => u.status === 'pending').length,
        inactive: searchedUsers.filter((u) => u.status === 'inactive').length,
    }

    const rowActions = (user: User): RowMenuItem[] =>
        user.status === 'pending'
            ? [
                  {
                      label: resendingUserId === user.id ? 'Sending activation…' : 'Resend activation email',
                      icon: 'refresh',
                      disabled: resendingUserId === user.id,
                      onSelect: () => void handleResendActivation(user),
                  },
                  {
                      label: 'Delete pending account',
                      icon: 'trash',
                      danger: true,
                      separatorBefore: true,
                      onSelect: () => void handleDeletePendingUser(user),
                  },
              ]
            : [
                  { label: 'Edit details', icon: 'edit', onSelect: () => handleOpenEditModal(user) },
                  user.status === 'active'
                      ? {
                            label: 'Deactivate account',
                            icon: 'close',
                            danger: true,
                            separatorBefore: true,
                            onSelect: () => handleDeactivateClick(user),
                        }
                      : {
                            label: 'Activate account',
                            icon: 'check',
                            separatorBefore: true,
                            onSelect: () => handleDeactivateClick(user),
                        },
              ]

    return (
        <div className="inv-scope min-h-screen pl-72 pb-16 antialiased print:pl-0" style={{ background: 'var(--inv-bg)' }}>
            <div className="print:hidden">
                <NavbarAdmin />
            </div>

            <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 pt-6 space-y-6">
                <button type="button" onClick={() => navigate('/admin-dashboard')} className="inv-back cursor-pointer">
                    <Icon name="arrowLeft" className="h-4 w-4" />
                    Admin dashboard
                </button>

                <div className="inv-page-header">
                    <div className="min-w-0">
                        <h1 className="inv-page-title">User management</h1>
                        <p className="inv-page-sub">
                            {users.length} staff {users.length === 1 ? 'account' : 'accounts'}
                            {counts.pending > 0 && ` · ${counts.pending} awaiting activation`}
                        </p>
                    </div>
                    <Button variant="primary" size="sm" icon="plus" onClick={handleOpenModal}>
                        New staff user
                    </Button>
                </div>

                {actionMessage && (
                    <Notice tone={actionMessage.type === 'success' ? 'success' : 'danger'}>{actionMessage.text}</Notice>
                )}

                <Card>
                    <CardHeader
                        title="Staff accounts"
                        description="Who can sign in, what role they hold, and whether their account is live."
                    />

                    <Toolbar>
                        <Segmented
                            options={[
                                { value: 'all', label: 'All', count: counts.all },
                                { value: 'active', label: 'Active', count: counts.active },
                                { value: 'pending', label: 'Pending', count: counts.pending },
                                { value: 'inactive', label: 'Inactive', count: counts.inactive },
                            ]}
                            value={statusFilter}
                            onChange={setStatusFilter}
                            label="Filter by account status"
                            size="sm"
                        />
                        <SearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search name, username or email"
                            label="Search staff accounts"
                            className="sm:ml-auto sm:w-72"
                        />
                    </Toolbar>

                    <div className="inv-table-wrap">
                        <table className="inv-table">
                            <thead>
                                <tr>
                                    <th scope="col">Staff member</th>
                                    <th scope="col">Username</th>
                                    <th scope="col">Role</th>
                                    <th scope="col">Contact</th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="is-actions">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            {users.length === 0 ? (
                                                <EmptyState
                                                    icon="box"
                                                    title="No staff accounts yet"
                                                    description="Create an account and the staff member gets an activation email to set their own password."
                                                    action={
                                                        <Button variant="primary" size="sm" icon="plus" onClick={handleOpenModal}>
                                                            New staff user
                                                        </Button>
                                                    }
                                                />
                                            ) : (
                                                <EmptyState
                                                    icon="search"
                                                    title="No accounts match this view"
                                                    description="Try a different status or clear the search."
                                                    action={
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => {
                                                                setStatusFilter('all')
                                                                setSearchTerm('')
                                                            }}
                                                        >
                                                            Clear filters
                                                        </Button>
                                                    }
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => {
                                        const status = STATUS_META[user.status]
                                        return (
                                            <tr key={user.id}>
                                                <td>
                                                    <div className="inv-cell-primary">{user.name}</div>
                                                    <div className="inv-cell-secondary">{user.id}</div>
                                                </td>
                                                <td className="inv-cell-primary">{user.username || '—'}</td>
                                                <td>
                                                    <Badge tone="neutral">{user.role}</Badge>
                                                </td>
                                                <td>
                                                    <div className="inv-cell-primary truncate max-w-[16rem]" title={user.email}>
                                                        {user.email || '—'}
                                                    </div>
                                                    <div className="inv-cell-secondary">{user.contact || 'No phone on file'}</div>
                                                </td>
                                                <td>
                                                    <Badge tone={status.tone} dot>
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                                <td className="is-actions">
                                                    <RowMenu items={rowActions(user)} label={`Actions for ${user.name}`} />
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        page={1}
                        pageSize={Math.max(filteredUsers.length, 1)}
                        total={filteredUsers.length}
                        onChange={() => {}}
                        noun={filteredUsers.length === 1 ? 'account' : 'accounts'}
                    />
                </Card>
            </main>

            {/* Create User Modal */}
            <Modal
                open={isModalOpen}
                onClose={handleCloseModal}
                size="md"
                title="New staff user"
                description="They receive an activation email and set their own password, so the account stays pending until they finish."
                onSubmit={handleCreateUser}
                footer={
                    <>
                        <Button variant="secondary" onClick={handleCloseModal} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={isCreating}>
                            {isCreating ? 'Creating…' : 'Create account'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Assigned user ID" htmlFor="create-id" hint="Generated automatically.">
                        <input id="create-id" type="text" className="inv-input" value={nextUserId} readOnly disabled />
                    </Field>

                    <div className="inv-grid-2">
                        <Field label="First name" htmlFor="create-first" required>
                            <input
                                id="create-first"
                                name="firstName"
                                type="text"
                                className="inv-input"
                                placeholder="Maria"
                                value={formData.firstName}
                                onChange={handleFirstNameChange}
                                required
                            />
                        </Field>
                        <Field label="Last name" htmlFor="create-last" required>
                            <input
                                id="create-last"
                                name="lastName"
                                type="text"
                                className="inv-input"
                                placeholder="Santos"
                                value={formData.lastName}
                                onChange={handleLastNameChange}
                                required
                            />
                        </Field>
                    </div>

                    <div className="inv-grid-2">
                        <Field label="Role" htmlFor="create-role" required>
                            <select
                                id="create-role"
                                name="role"
                                className="inv-select"
                                value={formData.role}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select a role</option>
                                <option value="Rider">Rider</option>
                                <option value="Cashier">Cashier</option>
                                <option value="Assistant">Assistant</option>
                                <option value="Kitchen Staff">Kitchen Staff</option>
                            </select>
                        </Field>
                        <Field
                            label="Username"
                            htmlFor="create-username"
                            optional
                            hint={
                                isUsernameCustom ? (
                                    <button
                                        type="button"
                                        className="inv-link"
                                        onClick={() => {
                                            setIsUsernameCustom(false)
                                            setFormData((prev) => ({
                                                ...prev,
                                                username: generateDefaultUsername(prev.firstName, prev.lastName),
                                            }))
                                        }}
                                    >
                                        Reset to auto-format
                                    </button>
                                ) : (
                                    'Filled in from the name until you edit it.'
                                )
                            }
                        >
                            <input
                                id="create-username"
                                name="username"
                                type="text"
                                className="inv-input"
                                placeholder="M.Santos"
                                value={formData.username}
                                onChange={handleUsernameChange}
                                maxLength={32}
                                pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"
                                title="Use 3–32 letters, numbers, dots, underscores, or hyphens."
                            />
                        </Field>
                    </div>

                    <Field label="Email address" htmlFor="create-email" required hint="The activation link is sent here.">
                        <input
                            id="create-email"
                            name="email"
                            type="email"
                            className="inv-input"
                            placeholder="staff@gmail.com"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                        />
                    </Field>

                    {createError && <Notice tone="danger">{createError}</Notice>}
                </div>
            </Modal>

            {/* Edit User Modal */}
            <Modal
                open={isEditModalOpen && !!editingUser}
                onClose={handleCloseEditModal}
                size="md"
                title="Edit staff user"
                description={editingUser ? `Account ${editingUser.id}` : undefined}
                onSubmit={handleUpdateUser}
                footer={
                    <>
                        <Button variant="secondary" onClick={handleCloseEditModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            Save changes
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {editError && <Notice tone="danger">{editError}</Notice>}

                    <div className="inv-grid-2">
                        <Field label="First name" htmlFor="edit-first" required>
                            <input
                                id="edit-first"
                                type="text"
                                className="inv-input"
                                placeholder="Maria"
                                value={editFormData.firstName}
                                onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                required
                            />
                        </Field>
                        <Field label="Last name" htmlFor="edit-last" required>
                            <input
                                id="edit-last"
                                type="text"
                                className="inv-input"
                                placeholder="Santos"
                                value={editFormData.lastName}
                                onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                required
                            />
                        </Field>
                    </div>

                    <Field label="Username" htmlFor="edit-username" optional>
                        <input
                            id="edit-username"
                            type="text"
                            className="inv-input"
                            placeholder="M.Santos"
                            value={editFormData.username}
                            onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                        />
                    </Field>

                    <div className="inv-grid-2">
                        <Field label="New password" htmlFor="edit-password" optional hint="Leave blank to keep the current one.">
                            <div className="inv-input-group">
                                <input
                                    id="edit-password"
                                    type={editFormData.showPassword ? 'text' : 'password'}
                                    className="inv-input"
                                    placeholder="••••••••"
                                    value={editFormData.password}
                                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="inv-input-suffix"
                                    onClick={() => setEditFormData((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                                    aria-label={editFormData.showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <Icon name={editFormData.showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                                </button>
                            </div>
                        </Field>
                        <Field label="Confirm new password" htmlFor="edit-confirm" optional>
                            <div className="inv-input-group">
                                <input
                                    id="edit-confirm"
                                    type={editFormData.showConfirmPassword ? 'text' : 'password'}
                                    className="inv-input"
                                    placeholder="••••••••"
                                    value={editFormData.confirmPassword}
                                    onChange={(e) => setEditFormData({ ...editFormData, confirmPassword: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="inv-input-suffix"
                                    onClick={() =>
                                        setEditFormData((prev) => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))
                                    }
                                    aria-label={editFormData.showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    <Icon name={editFormData.showConfirmPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                                </button>
                            </div>
                        </Field>
                    </div>
                </div>
            </Modal>

            {/* Deactivation Confirmation */}
            <Modal
                open={!!deactivatingUser}
                onClose={() => setDeactivatingUser(null)}
                size="sm"
                role="alertdialog"
                title="Deactivate this account?"
                description={
                    deactivatingUser
                        ? `${deactivatingUser.name} (${deactivatingUser.username}) loses access to the staff portals until the account is reactivated.`
                        : undefined
                }
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setDeactivatingUser(null)}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={() => void handleConfirmDeactivate()}>
                            Deactivate account
                        </Button>
                    </>
                }
            >
                <Notice tone="warning">
                    Orders and records already created by this account are kept. Only sign-in is revoked.
                </Notice>
            </Modal>

        </div>
    )
}

export default UserManagement