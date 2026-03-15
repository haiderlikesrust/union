'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/pocketbase';

export default function ResetPasswordPage() {
    const pb = createBrowserClient();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            toast.error('Missing reset token');
            return;
        }
        if (!password || password !== passwordConfirm) {
            toast.error('Passwords do not match');
            return;
        }
        setIsSubmitting(true);
        try {
            await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
            toast.success('Password reset successfully. You can now log in.');
        } catch {
            toast.error('Failed to reset password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-bg-primary">
            <div className="w-full max-w-md bg-bg-secondary rounded-2xl border border-border p-6">
                <h1 className="text-xl font-bold mb-2">Reset password</h1>
                <p className="text-sm text-text-muted mb-6">Enter your new password.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none transition-colors"
                        required
                    />
                    <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none transition-colors"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Resetting...' : 'Reset password'}
                    </button>
                </form>
                <div className="mt-4 text-sm text-text-muted">
                    <Link href="/login" className="text-accent hover:text-accent-hover">Back to login</Link>
                </div>
            </div>
        </div>
    );
}
