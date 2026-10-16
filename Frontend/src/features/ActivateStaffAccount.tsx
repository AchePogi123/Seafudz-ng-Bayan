import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { API_BASE_URL } from '../utils/api'

interface ActivationProfile {
    name: string
    username: string
    email: string
    role: string
}

const ActivateStaffAccount = () => {
    const location = useLocation()
    const token = new URLSearchParams(location.hash.slice(1)).get('token') || ''
    const [profile, setProfile] = useState<ActivationProfile | null>(null)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isValidating, setIsValidating] = useState(Boolean(token))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isComplete, setIsComplete] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        window.history.replaceState(null, document.title, window.location.pathname)
        if (!token) return

        const validateToken = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/staff-activation/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                })
                const payload = await response.json()
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'This activation link is invalid or expired.')
                }
                setProfile(payload.data)
                setUsername(payload.data.username || '')
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : 'Could not validate this activation link.')
            } finally {
                setIsValidating(false)
            }
        }

        void validateToken()
    }, [token])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrorMessage('')

        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(username.trim())) {
            setErrorMessage('Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.')
            return
        }
        if (password.length < 12 || password.length > 128) {
            setErrorMessage('Password must be between 12 and 128 characters.')
            return
        }
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await fetch(`${API_BASE_URL}/auth/staff-activation/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, username: username.trim(), password }),
            })
            const payload = await response.json()
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Could not activate this account.')
            }
            setIsComplete(true)
            setPassword('')
            setConfirmPassword('')
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not activate this account.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const displayedError = errorMessage || (!token ? 'This activation link is invalid or expired. Ask your administrator to send a new one.' : '')

    return (
        <main className="flex min-h-screen items-center justify-center bg-orange-50/50 px-4 py-10">
            <section className="w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-6 shadow-xl shadow-orange-900/5 sm:p-9">
                <div className="mb-7 flex flex-col items-center text-center">
                    <BrandLogo size="md" subtitle="SEAFOOD & BILAO FEASTS" />
                    <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Staff account setup</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                        {isComplete ? 'Account activated' : 'Activate your account'}
                    </h1>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                        {isComplete
                            ? 'Your account is ready. Sign in with your new username and password.'
                            : 'Confirm your assigned details and choose the credentials you will use to sign in.'}
                    </p>
                </div>

                {displayedError && (
                    <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {displayedError}
                    </div>
                )}

                {isValidating && (
                    <p role="status" className="py-8 text-center text-sm font-semibold text-slate-500">Checking your activation link…</p>
                )}

                {!isValidating && !isComplete && profile && (
                    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 rounded-2xl bg-orange-50/70 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Name</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{profile.name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Assigned role</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{profile.role}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Email</p>
                                <p className="mt-1 break-all text-sm font-semibold text-slate-700">{profile.email}</p>
                            </div>
                            <p className="self-end text-[10px] font-medium leading-relaxed text-slate-500 sm:text-right">
                                Your assigned role cannot be changed during activation.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="activation-username" className="mb-1.5 block text-xs font-bold text-slate-700">Preferred username</label>
                            <input
                                id="activation-username"
                                type="text"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                autoComplete="username"
                                minLength={3}
                                maxLength={32}
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                            />
                        </div>

                        <div>
                            <label htmlFor="activation-password" className="mb-1.5 block text-xs font-bold text-slate-700">Create password</label>
                            <input
                                id="activation-password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                minLength={12}
                                maxLength={128}
                                required
                                placeholder="At least 12 characters"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                            />
                        </div>

                        <div>
                            <label htmlFor="activation-confirm-password" className="mb-1.5 block text-xs font-bold text-slate-700">Confirm password</label>
                            <input
                                id="activation-confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                autoComplete="new-password"
                                minLength={12}
                                maxLength={128}
                                required
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'Activating account…' : 'Confirm and activate'}
                        </button>
                    </form>
                )}

                {!isValidating && isComplete && (
                    <div className="text-center">
                        <Link to="/login" className="inline-flex rounded-xl bg-orange-500 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-orange-600">
                            Go to sign in
                        </Link>
                    </div>
                )}
            </section>
        </main>
    )
}

export default ActivateStaffAccount
