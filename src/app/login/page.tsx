'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/site-settings';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            router.push('/');
        } catch (err: any) {
            toast.error(err?.response?.message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    const { siteName, logoUrl } = useSiteSettings();
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-bg-primary">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-white">
                                TU
                            </div>
                        )}
                        <span className="text-2xl font-bold">{siteName}</span>
                    </Link>
                    <p className="text-text-muted text-sm mt-2">Welcome back to the conversation</p>
                </div>

                <div className="bg-bg-secondary rounded-2xl border border-border p-6">
                    <h1 className="text-xl font-bold mb-6">Log in</h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Email or Username</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                                placeholder="you@email.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                                placeholder="••••••••"
                                required
                            />
                            <div className="mt-2 text-right">
                                <Link href="/forgot-password" className="text-xs text-accent hover:text-accent-hover transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-accent/20"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Logging in...
                                </span>
                            ) : 'Log in'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-text-muted">
                        Don&#39;t have an account?{' '}
                        <Link href="/signup" className="text-accent hover:text-accent-hover font-medium transition-colors">
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
