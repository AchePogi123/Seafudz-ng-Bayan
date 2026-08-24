import { useState } from 'react';
import { Navbar } from '../components/Navbar';

interface User {
    id: string;
    name: string;
    username: string;
    contact: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
}

const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        password: '',
        contact: '',
        email: '',
        role: '',
    });

    // Calculate Next User ID
    const nextUserId = `U${String(100 + users.length + 1).padStart(3, '0')}`;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({
            fullName: '',
            username: '',
            password: '',
            contact: '',
            email: '',
            role: '',
        });
    };

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName.trim() || !formData.role) {
            alert('Full Name and Role are required!');
            return;
        }

        const newUser: User = {
            id: nextUserId,
            name: formData.fullName.trim(),
            username: formData.username.trim(),
            contact: formData.contact.trim() || '-',
            email: formData.email.trim() || '-',
            role: formData.role,
            status: 'active',
        };

        setUsers([...users, newUser]);
        handleCloseModal();
    };

    const toggleStatus = (id: string) => {
        setUsers(
            users.map((u) =>
                u.id === id
                    ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } as User
                    : u
            )
        );
    };

    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="font-sans bg-[#f7fafc] min-h-screen text-[#2d3748] pb-12">
            {/* Role-Based Navigation Bar */}
            <div className="max-w-7xl mx-auto px-4 pt-4">
                <Navbar />
            </div>

            {/* Main Content Area */}
            <div className="max-w-[1200px] mx-auto py-[3rem] px-[2rem]">
                <div className="flex justify-between items-center mb-[2.5rem] flex-wrap gap-[1.5rem]">
                    <div>
                        <h1 className="text-[2.2rem] font-extrabold text-[#1a202c] m-0 tracking-[-0.5px]">👥 User Management</h1>
                        <p className="text-[1rem] text-[#718096] m-0">Manage system access for staff and operational team</p>
                    </div>
                    <button className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.9rem] px-[1.8rem] rounded-[12px] font-bold text-[0.95rem] font-sans cursor-pointer shadow-[0_4px_15px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_6px_20px_rgba(231,76,60,0.35)]" onClick={handleOpenModal}>
                        + Create New User
                    </button>
                </div>

                <div className="mb-[1.8rem]">
                    <input
                        type="text"
                        className="w-full max-w-[450px] py-[0.9rem] px-[1.2rem] rounded-[12px] border border-[#e2e8f0] bg-white font-sans text-[0.95rem] text-[#2d3748] transition-all duration-[0.25s] shadow-[0_2px_6px_rgba(0,0,0,0.01)] focus:outline-none focus:border-[#e74c3c] focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                        placeholder="Search by name, role, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* User Data Table */}
                <div className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-black/[0.04] overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[0.95rem]">
                        <thead>
                            <tr>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">User ID</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Full Name</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Role</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Contact</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Email</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Status</th>
                                <th className="bg-[#f7fafc] text-[#718096] font-bold py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[0.85rem] uppercase tracking-[0.5px]">Actions</th>
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
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">
                                            <strong>{user.id}</strong>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">{user.name}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">
                                            <span className="bg-[#ebf8ff] text-[#2b6cb0] py-[0.35rem] px-[0.8rem] rounded-[50px] text-[0.8rem] font-bold inline-block">{user.role}</span>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">{user.contact}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">{user.email}</td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">
                                            <span className={`py-[0.35rem] px-[0.8rem] rounded-[50px] text-[0.78rem] font-bold inline-block tracking-[0.5px] ${user.status === 'active' ? 'bg-[#e6fffa] text-[#319795]' : 'bg-[#fff5f5] text-[#e53e3e]'
                                                }`}>
                                                {user.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-[1.2rem] px-[1.5rem] border-b border-[#edf2f7] text-[#4a5568]">
                                            <button
                                                className={`bg-none border border-solid py-[0.5rem] px-[1rem] rounded-[8px] text-[0.85rem] font-bold font-sans cursor-pointer transition-all duration-200 ${user.status === 'active'
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

            {/* Clean Modern Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-[#1a202c]/40 backdrop-blur-[4px] flex justify-center items-center z-[1000] animate-fade-in-modal" onClick={handleCloseModal}>
                    <div className="bg-white w-full max-w-[650px] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-slide-up-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="py-[1.8rem] px-[2.2rem] border-b border-[#edf2f7] flex justify-between items-center">
                            <h2 className="text-[1.45rem] font-extrabold text-[#2d3748] m-0">Create New Staff User</h2>
                            <button className="bg-none border-none text-[1.8rem] text-[#a0aec0] cursor-pointer transition-all duration-200 p-0 leading-none hover:text-[#4a5568]" onClick={handleCloseModal}>
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-[2.2rem]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[1.5rem] mb-[2.5rem]">
                                {/* Auto User ID */}
                                <div className="md:col-span-2 col-span-1 flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Assigned User ID</label>
                                    <input type="text" value={nextUserId} readOnly className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#718096] bg-[#edf2f7] font-bold cursor-not-allowed box-border focus:outline-none" />
                                </div>

                                {/* Full Name */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        Full Name <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        placeholder="e.g. Juan Cruz"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                {/* Role Selection */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">
                                        Role <span className="text-[#e74c3c]">*</span>
                                    </label>
                                    <select
                                        name="role"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
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

                                {/* Username */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="e.g. juancruz"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                {/* Password */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                {/* Contact */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Contact Number</label>
                                    <input
                                        type="tel"
                                        name="contact"
                                        placeholder="0912 345 6789"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                                        value={formData.contact}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                {/* Email */}
                                <div className="flex flex-col gap-[0.5rem]">
                                    <label className="text-[0.9rem] font-bold text-[#4a5568]">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="staff@gmail.com"
                                        className="py-[0.85rem] px-[1rem] rounded-[10px] border border-[#e2e8f0] font-sans text-[0.92rem] text-[#2d3748] bg-[#f7fafc] transition-all duration-[0.25s] box-border focus:outline-none focus:border-[#e74c3c] focus:bg-white focus:shadow-[0_0_0_4px_rgba(231,76,60,0.1)]"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-[1rem] border-t border-[#edf2f7] pt-[1.5rem]">
                                <button type="button" className="bg-[#edf2f7] text-[#4a5568] border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold text-[0.95rem] font-sans cursor-pointer transition-all duration-200 hover:bg-[#e2e8f0]" onClick={handleCloseModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="bg-gradient-to-r from-[#e74c3c] to-[#d35400] text-white border-none py-[0.85rem] px-[1.8rem] rounded-[10px] font-bold text-[0.95rem] font-sans cursor-pointer shadow-[0_4px_15px_rgba(231,76,60,0.2)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_6px_20px_rgba(231,76,60,0.35)]">
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
