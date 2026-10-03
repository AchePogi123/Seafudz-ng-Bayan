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
    status: 'active' | 'inactive'
}

const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([
        { id: 'U101', name: 'Maria Santos', username: 'M.Santos', contact: '09171234567', email: 'maria.cashier@seafudz.ph', role: 'Cashier', status: 'active' },
        { id: 'U102', name: 'Ben Chef', username: 'B.Chef', contact: '09182345678', email: 'chef.ben@seafudz.ph', role: 'Kitchen Staff', status: 'active' },
        { id: 'U103', name: 'Dan Cruz', username: 'D.Cruz', contact: '09193456789', email: 'dan.rider@seafudz.ph', role: 'Rider', status: 'active' },
        { id: 'U104', name: 'Joy Flores', username: 'J.Flores', contact: '09204567890', email: 'joy.floor@seafudz.ph', role: 'Assistant', status: 'active' },
    ])
    const [idCounter, setIdCounter] = useState(105)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUsernameCustom, setIsUsernameCustom] = useState(false)

    // Edit modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editFormData, setEditFormData] = useState({
        name: '',
        username: '',
        password: '',
        contact: '',
        email: '',
        role: '',
    })

    // Deactivation confirmation modal state
    const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null)

    // Create user form data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        confirmPassword: '',
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
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    setUsers(data.data)
                    setIdCounter(101 + data.data.length)
                }
            } catch (err) {
                console.warn('Could not load users from backend DB, using initial state:', err)
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
        if (firstInitial && cleanLast) {
            return `${firstInitial}.${cleanLast}`
        } else if (firstInitial) {
            return `${firstInitial}.`
        }
        return cleanLast
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
        setFormData({
            firstName: '',
            lastName: '',
            username: '',
            password: '',
            confirmPassword: '',
            contact: '',
            email: '',
            role: '',
        })
    }

    // Open Edit Modal
    const handleOpenEditModal = (user: User) => {
        setEditingUser(user)
        setEditFormData({
            name: user.name,
            username: user.username,
            password: '',
            contact: user.contact === '-' ? '' : user.contact,
            email: user.email === '-' ? '' : user.email,
            role: user.role,
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
        if (!editingUser || !editFormData.name.trim()) return

        const updatedUser: User = {
            ...editingUser,
            name: editFormData.name.trim(),
            username: editFormData.username.trim() || editingUser.username,
            contact: editFormData.contact.trim() || '-',
            email: editFormData.email.trim() || '-',
            role: editFormData.role || editingUser.role,
        }

        const identifier = editingUser.db_id || editingUser.username || editingUser.email || editingUser.id

        // Optimistically update local UI state
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedUser : u)))

        // Persist edits to PostgreSQL database via API
        try {
            const headers = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    name: editFormData.name.trim(),
                    username: editFormData.username.trim(),
                    password: editFormData.password,
                    contact: editFormData.contact.trim(),
                    email: editFormData.email.trim(),
                    role: editFormData.role,
                }),
            })
            const data = await res.json()
            if (data.success && data.data) {
                const saved = data.data
                setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? {
                    ...u,
                    name: saved.name || updatedUser.name,
                    username: saved.username || updatedUser.username,
                    contact: saved.contact || updatedUser.contact,
                    email: saved.email || updatedUser.email,
                    role: saved.role || updatedUser.role,
                } : u)))
            }
        } catch (err) {
            console.warn('Failed to update user in backend database:', err)
        }

        handleCloseEditModal()
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.role) {
            alert('First Name, Last Name, and Role are required!')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match! Please check and re-enter your password.')
            return
        }

        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`
        const finalUsername =
            formData.username.trim() || generateDefaultUsername(formData.firstName, formData.lastName)

        const newUser: User = {
            id: nextUserId,
            name: fullName,
            username: finalUsername,
            contact: formData.contact.trim() || '-',
            email: formData.email.trim() || '-',
            role: formData.role,
            status: 'active',
        }

        // Save to PostgreSQL database via Backend API
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
            if (data.success && data.data) {
                const saved = data.data
                setUsers((prev) => [...prev, {
                    id: saved.id || nextUserId,
                    name: saved.name || fullName,
                    username: saved.username || finalUsername,
                    contact: saved.contact || '-',
                    email: saved.email || '-',
                    role: saved.role || formData.role,
                    status: saved.status || 'active',
                }])
            } else {
                setUsers((prev) => [...prev, newUser])
            }
        } catch (err) {
            console.warn('Failed to persist user to backend DB, updating local state:', err)
            setUsers((prev) => [...prev, newUser])
        }

        setIdCounter((prev) => prev + 1)
        handleCloseModal()
    }

    const toggleStatus = async (id: string) => {
        const target = users.find((u) => u.id === id)
        if (!target) return
        const nextStatus = target.status === 'active' ? 'inactive' : 'active'

        setUsers((prev) =>
            prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u))
        )

        try {
            const headers = await getAuthHeaders()
            await fetch(`${API_BASE_URL}/users/${encodeURIComponent(id)}/toggle-status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: nextStatus }),
            })
        } catch (err) {
            console.warn('Status toggle persistence error:', err)
        }
    }

    const handleDeactivateClick = (user: User) => {
        if (user.status === 'active') {
            setDeactivatingUser(user)
        } else {
            void toggleStatus(user.id)
        }
    }

    const handleConfirmDeactivate = async () => {
        if (!deactivatingUser) return
        await toggleStatus(deactivatingUser.id)
        setDeactivatingUser(null)
    }

    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                        placeholder="Search by name, role, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

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
                                                className={`py-[0.35rem] px-[0.8rem] rounded-[50px] text-[0.78rem] font-bold ${user.status === 'active'
                                                    ? 'bg-[#e6fffa] text-[#319795]'
                                                    : 'bg-[#fff5f5] text-[#e53e3e]'
                                                    }`}
                                            >
                                                {user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">
                                            <div className="flex items-center gap-2">
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
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Confirm Password</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="••••••••"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Contact Number</label>
                                    <input
                                        type="tel"
                                        name="contact"
                                        placeholder="0912 345 6789"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.contact}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="staff@gmail.com"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

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
                                    className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold cursor-pointer"
                                >
                                    Create User
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
                                <div className="flex flex-col gap-[0.5rem] md:col-span-2">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Full Name <span className="text-[#e74c3c]">*</span></label>
                                    <input
                                        type="text"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Username</label>
                                    <input
                                        type="text"
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

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Role</label>
                                    <select
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.role}
                                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                                    >
                                        <option value="Rider">Rider</option>
                                        <option value="Cashier">Cashier</option>
                                        <option value="Assistant">Assistant</option>
                                        <option value="Kitchen Staff">Kitchen Staff</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Contact Number</label>
                                    <input
                                        type="tel"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={editFormData.contact}
                                        onChange={(e) => setEditFormData({ ...editFormData, contact: e.target.value })}
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