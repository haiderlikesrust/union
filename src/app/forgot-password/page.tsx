'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/pocketbase';

export default function ForgotPasswordPage() {
    const pb = createBrowserClient();
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setIsSending(true);
        try {
            await pb.collection('users').requestPasswordReset(email.trim());
            toast.success('Reset email sent. Check your inbox.');
        } catch {
            toast.error('Failed to send reset email');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-bg-primary">
            <div className="w-full max-w-md bg-bg-secondary rounded-2xl border border-border p-6">
                <h1 className="text-xl font-bold mb-2">Forgot password</h1>
                <p className="text-sm text-text-muted mb-6">Enter your email and we will send a reset link.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none transition-colors"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isSending}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                        {isSending ? 'Sending...' : 'Send reset link'}
                    </button>
                </form>
                <div className="mt-4 text-sm text-text-muted">
                    <Link href="/login" className="text-accent hover:text-accent-hover">Back to login</Link>
                </div>
            </div>
        </div>
    );
}
