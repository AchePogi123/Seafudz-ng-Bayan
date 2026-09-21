import { useState } from 'react'
import NavbarAdmin from '../components/NavbarAdmin'

interface User {
    id: string
    name: string
    username: string
    contact: string
    email: string
    role: string
    status: 'active' | 'inactive'
}

const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)

    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        password: '',
        contact: '',
        email: '',
        role: '',
    })

    const nextUserId = `U${String(100 + users.length + 1).padStart(3, '0')}`

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleOpenModal = () => setIsModalOpen(true)

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setFormData({
            fullName: '',
            username: '',
            password: '',
            contact: '',
            email: '',
            role: '',
        })
    }

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.fullName.trim() || !formData.role) {
            alert('Full Name and Role are required!')
            return
        }

        const newUser: User = {
            id: nextUserId,
            name: formData.fullName.trim(),
            username: formData.username.trim(),
            contact: formData.contact.trim() || '-',
            email: formData.email.trim() || '-',
            role: formData.role,
            status: 'active',
        }

        setUsers([...users, newUser])
        handleCloseModal()
    }

    const toggleStatus = (id: string) => {
        setUsers(
            users.map((u) =>
                u.id === id
                    ? ({ ...u, status: u.status === 'active' ? 'inactive' : 'active' } as User)
                    : u
            )
        )
    }

    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="font-sans bg-[#f7fafc] min-h-screen text-[#2d3748]">
            {/* Admin Navbar */}
            <div className="p-4 sm:p-6">
                <NavbarAdmin />
            </div>

            {/* Main Content */}
            <div className="max-w-[1200px] mx-auto py-[3rem] px-[2rem]">
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
                                    <td colSpan={7} className="text-center py-[5rem] px-[2rem] text-[#a0aec0]">
                                        <h3 className="text-[1.3rem] text-[#4a5568] mb-[0.5rem] mt-0 font-bold">No Users Found</h3>
                                        <p className="m-0 text-[0.95rem]">Click "+ Create New User" above to add new staff members.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#fcfdfe]/50">
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]"><strong>{user.id}</strong></td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7]">{user.name}</td>
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
                                            <button
                                                className={`border border-solid py-[0.5rem] px-[1rem] rounded-[8px] text-[0.85rem] font-bold cursor-pointer ${user.status === 'active'
                                                    ? 'border-[#feb2b2] text-[#e53e3e] hover:bg-[#fff5f5]'
                                                    : 'border-[#b2f5ea] text-[#319795] hover:bg-[#e6fffa]'
                                                    }`}
                                                onClick={() => toggleStatus(user.id)}
                                            >
                                                {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </button>
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
                                        Full Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        placeholder="e.g. Juan Cruz"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
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
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="e.g. juancruz"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] bg-[#f7fafc] focus:outline-none focus:border-[#e74c3c]"
                                        value={formData.username}
                                        onChange={handleInputChange}
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
        </div>
    )
}

export default UserManagement