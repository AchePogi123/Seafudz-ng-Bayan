import { useState, useEffect } from 'react'
import NavbarAdmin from '../components/NavbarAdmin'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'

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
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editFormData, setEditFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        password: '',
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
        })
        setIsEditModalOpen(true)
    }

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false)
        setEditingUser(null)
    }

    // Submit Edit User
    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingUser) return
        const cleanFirst = editFormData.firstName.trim()
        const cleanLast = editFormData.lastName.trim()
        if (!cleanFirst || !cleanLast) {
            alert('First Name and Last Name are required.')
            return
        }

        const fullName = `${cleanFirst} ${cleanLast}`
        const updatedUser: User = {
            ...editingUser,
            name: fullName,
            username: editFormData.username.trim() || editingUser.username,
        }

        const identifier = editingUser.db_id || editingUser.username || editingUser.email || editingUser.id

        // Optimistically update local UI state
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedUser : u)))

        // Persist edits to PostgreSQL database via API
        try {
            const headers = await getAuthHeaders()
            const payload: { name: string; username: string; password?: string } = {
                name: fullName,
                username: editFormData.username.trim(),
            }
            if (editFormData.password.trim()) {
                payload.password = editFormData.password.trim()
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

            if (data.data) {
                const saved = data.data
                setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? {
                    ...u,
                    name: saved.name || updatedUser.name,
                    username: saved.username || updatedUser.username,
                    role: saved.role || updatedUser.role,
                } : u)))
            }
            setActionMessage({
                type: 'success',
                text: editFormData.password.trim()
                    ? `Staff ${fullName} updated and new password set successfully.`
                    : `Staff ${fullName} updated successfully.`,
            })
        } catch (err) {
            console.warn('Failed to update user in backend database:', err)
            setActionMessage({
                type: 'error',
                text: err instanceof Error ? err.message : 'Failed to update user in database.',
            })
        }

        handleCloseEditModal()
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
    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="font-sans bg-[#f7fafc] min-h-screen text-[#2d3748]">
            {/* Admin Navbar */}
            <div className="p-4 sm:p-6">
                <NavbarAdmin />
            </div>

            {/* Main Content */}
            <div className="w-full px-4 sm:px-8 lg:px-10 py-[2rem] sm:py-[3rem]">
                <div className="flex justify-between items-center mb-[2.5rem] flex-wrap gap-[1.5rem]">
                    <div>
                        <h1 className="text-[2.2rem] font-extrabold text-[#1a202c] m-0 tracking-[-0.5px]">
                            User Management
                        </h1>
                        <p className="text-[1rem] text-[#718096] m-0">
                            Manage system access for staff and operational team
                        </p>
                    </div>
                    <button
                        className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.9rem] px-[1.8rem] rounded-[12px] font-bold text-[0.95rem] cursor-pointer shadow-[0_4px_15px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px]"
                        onClick={handleOpenModal}
                    >
                        + Create New User
                    </button>
                </div>

                <div className="mb-[1.8rem]">
                    <input
                        type="text"
                        className="w-full max-w-[450px] py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] bg-white text-[0.95rem] text-[#2d3748] focus:outline-none focus:border-[#e74c3c] focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                        placeholder="Search by name, role, username, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {actionMessage && (
                    <div
                        role="status"
                        className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
                            actionMessage.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                    >
                        {actionMessage.text}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[0.95rem]">
                        <thead>
                            <tr>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">User ID</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Full Name</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Username</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Role</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Contact</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Email</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Status</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-[5rem] px-[2rem] text-[#a0aec0]">
                                        <h3 className="text-[1.3rem] text-[#4a5568] mb-[0.5rem] mt-0 font-bold">No Users Found</h3>
                                        <p className="m-0 text-[0.95rem]">Click "+ Create New User" above to add new staff members.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#fcfdfe]/50">
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]"><strong>{user.id}</strong></td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">{user.name}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] font-semibold text-[#4a5568]">{user.username}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">
                                            <span className="bg-[#ebf8ff] text-[#2b6cb0] py-[0.35rem] px-[0.8rem] rounded-[50px] text-[0.8rem] font-bold">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">{user.contact}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">{user.email}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">
                                            <span
                                                className={`py-[0.35rem] px-[0.8rem] rounded-[50px] text-[0.78rem] font-bold ${
                                                    user.status === 'active'
                                                        ? 'bg-[#e6fffa] text-[#319795]'
                                                        : user.status === 'pending'
                                                            ? 'bg-amber-50 text-amber-700'
                                                            : 'bg-[#fff5f5] text-[#e53e3e]'
                                                }`}
                                            >
                                                {user.status === 'pending' ? 'PENDING ACTIVATION' : user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">
                                            <div className="flex items-center gap-2">
                                                {user.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={resendingUserId === user.id}
                                                            className="border border-solid border-orange-200 bg-orange-50 py-[0.5rem] px-[0.9rem] rounded-[8px] text-[0.8rem] font-bold text-orange-700 cursor-pointer transition-colors hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
                                                            onClick={() => void handleResendActivation(user)}
                                                        >
                                                            {resendingUserId === user.id ? 'Sending…' : 'Resend activation'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="border border-solid border-rose-200 py-[0.5rem] px-[0.9rem] rounded-[8px] text-[0.8rem] font-bold text-rose-600 cursor-pointer transition-colors hover:bg-rose-50"
                                                            onClick={() => void handleDeletePendingUser(user)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="border border-solid border-[#e2e8f0] bg-[#edf2f7] hover:bg-[#e2e8f0] text-[#4a5568] py-[0.5rem] px-[0.9rem] rounded-[8px] text-[0.85rem] font-bold cursor-pointer transition-colors"
                                                            onClick={() => handleOpenEditModal(user)}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`border border-solid py-[0.5rem] px-[1rem] rounded-[8px] text-[0.85rem] font-bold cursor-pointer ${user.status === 'active'
                                                                ? 'border-[#feb2b2] text-[#e53e3e] hover:bg-[#fff5f5]'
                                                                : 'border-[#b2f5ea] text-[#319795] hover:bg-[#e6fffa]'
                                                                }`}
                                                            onClick={() => handleDeactivateClick(user)}
                                                        >
                                                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-[#1a202c]/40 backdrop-blur-[4px] flex justify-center items-center z-[1000]"
                    onClick={handleCloseModal}
                >
                    <div
                        className="bg-white w-full max-w-[650px] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="py-[1.8rem] px-[2.2rem] border-b border-[#edf2f7] flex justify-between items-center">
                            <h2 className="text-[1.45rem] font-extrabold text-[#2d3748] m-0">Create New Staff User</h2>
                            <button
                                className="bg-none border-none text-[1.8rem] text-[#a0aec0] cursor-pointer hover:text-[#4a5568]"
                                onClick={handleCloseModal}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-[2.2rem]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.5rem] mb-[2.5rem]">
                                <div className="md:col-span-2 flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Assigned User ID</label>
                                    <input
                                        type="text"
                                        value={nextUserId}
                                        readOnly
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] text-[#718096] bg-[#edf2f7] font-bold cursor-not-allowed"
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        First Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        placeholder="e.g. Maria"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.firstName}
                                        onChange={handleFirstNameChange}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        Last Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        placeholder="e.g. Santos"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.lastName}
                                        onChange={handleLastNameChange}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        Role <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <select
                                        name="role"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Select Role</option>
                                        <option value="Rider">Rider</option>
                                        <option value="Cashier">Cashier</option>
                                        <option value="Assistant">Assistant</option>
                                        <option value="Kitchen Staff">Kitchen Staff</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[0.9rem] font-bold text-[#4a5568]">Username</label>
                                        {isUsernameCustom && (
                                            <button
                                                type="button"
                                                className="text-[0.75rem] text-[#e74c3c] hover:underline bg-transparent border-none p-0 cursor-pointer"
                                                onClick={() => {
                                                    setIsUsernameCustom(false)
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        username: generateDefaultUsername(prev.firstName, prev.lastName),
                                                    }))
                                                }}
                                            >
                                                Reset auto-format
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="e.g. M.Santos"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.username}
                                        onChange={handleUsernameChange}
                                        maxLength={32}
                                        pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}"
                                        title="Use 3–32 letters, numbers, dots, underscores, or hyphens."
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem] md:col-span-2">
                                        <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                            Email Address <span className="text-[#e74c3c]">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                        placeholder="staff@gmail.com"
                                            className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                            <p className="mb-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs leading-relaxed text-orange-800">
                                An activation link will be emailed to the staff member. Their account remains pending until they set a password and username.
                            </p>
                            {createError && (
                                <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                                    {createError}
                                </p>
                            )}

                            <div className="flex justify-end gap-[1rem] border-t border-[#edf2f7] pt-[1.5rem]">
                                <button
                                    type="button"
                                    className="bg-[#edf2f7] text-[#4a5568] border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold cursor-pointer hover:bg-[#e2e8f0]"
                                    onClick={handleCloseModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold cursor-pointer disabled:cursor-wait disabled:opacity-60"
                                >
                                    {isCreating ? 'Creating…' : 'Create Pending Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && editingUser && (
                <div
                    className="fixed inset-0 bg-[#1a202c]/40 backdrop-blur-[4px] flex justify-center items-center z-[1000]"
                    onClick={handleCloseEditModal}
                >
                    <div
                        className="bg-white w-full max-w-[600px] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="py-[1.8rem] px-[2.2rem] border-b border-[#edf2f7] flex justify-between items-center">
                            <div>
                                <h2 className="text-[1.35rem] font-extrabold text-[#2d3748] m-0">Edit Staff User</h2>
                                <p className="text-xs text-slate-500 m-0 mt-0.5">Assigned ID: {editingUser.id}</p>
                            </div>
                            <button
                                className="bg-none border-none text-[1.8rem] text-[#a0aec0] cursor-pointer hover:text-[#4a5568]"
                                onClick={handleCloseEditModal}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-[2.2rem]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.5rem] mb-[2rem]">
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        First Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Maria"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.firstName}
                                        onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        Last Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Santos"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.lastName}
                                        onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Username</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. M.Santos"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.username}
                                        onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">New Password (Optional)</label>
                                    <input
                                        type="password"
                                        placeholder="Leave blank to keep current password"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.password}
                                        onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-[1rem] border-t border-[#edf2f7] pt-[1.5rem]">
                                <button
                                    type="button"
                                    className="bg-[#edf2f7] text-[#4a5568] border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold cursor-pointer hover:bg-[#e2e8f0]"
                                    onClick={handleCloseEditModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deactivation Confirmation Modal Popup */}
            {deactivatingUser && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center items-center z-[1000] p-4"
                    onClick={() => setDeactivatingUser(null)}
                >
                    <div
                        className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>

                            <h3 className="text-lg font-extrabold text-slate-800 mb-1">Confirm User Deactivation</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Are you sure you want to deactivate <strong className="text-slate-700">{deactivatingUser.name}</strong> (<span className="font-mono text-xs">{deactivatingUser.username}</span>)? They will temporarily lose access to staff portals until reactivated.
                            </p>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => setDeactivatingUser(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
                                    onClick={handleConfirmDeactivate}
                                >
                                    Deactivate User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default UserManagement