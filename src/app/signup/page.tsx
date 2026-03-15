'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/site-settings';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignupPage() {
    const { signup } = useAuth();
    const { siteName, logoUrl } = useSiteSettings();
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== passwordConfirm) {
            toast.error('Passwords don\'t match');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (username.length < 3) {
            toast.error('Username must be at least 3 characters');
            return;
        }

        setIsLoading(true);
        try {
            await signup(username, email, password, passwordConfirm);
            toast.success(`Welcome to ${siteName}!`);
            router.push('/');
        } catch (err: any) {
            const msg = err?.response?.data?.username?.message
                || err?.response?.data?.email?.message
                || err?.response?.message
                || 'Failed to create account';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

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
                    <p className="text-text-muted text-sm mt-2">Join the conversation</p>
                </div>

                <div className="bg-bg-secondary rounded-2xl border border-border p-6">
                    <h1 className="text-xl font-bold mb-6">Create account</h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                                placeholder="your_username"
                                minLength={3}
                                maxLength={30}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                            <input
                                type="email"
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
                                minLength={8}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                            <input
                                type="password"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                                placeholder="••••••••"
                                required
                            />
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
                                    Creating account...
                                </span>
                            ) : `Join ${siteName}`}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-text-muted">
                        Already have an account?{' '}
                        <Link href="/login" className="text-accent hover:text-accent-hover font-medium transition-colors">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
