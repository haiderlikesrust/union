'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ReportReason } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
    { value: 'spam', label: 'Spam' },
    { value: 'abuse', label: 'Abuse or harassment' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'off-topic', label: 'Off-topic or irrelevant' },
];

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: 'post' | 'comment';
    targetId: string;
    onSuccess?: () => void;
}

export function ReportModal({ isOpen, onClose, targetType, targetId, onSuccess }: ReportModalProps) {
    const { pb, user } = useAuth();
    const [reason, setReason] = useState<ReportReason | ''>('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !reason) return;
        setIsSubmitting(true);
        try {
            await pb.collection('reports').create({
                reporter: user.id,
                targetType,
                targetId,
                reason: reason as ReportReason,
                details: details.trim().slice(0, 2000),
                status: 'pending',
            });
            toast.success('Report submitted. Moderators will review it.');
            setReason('');
            setDetails('');
            onClose();
            onSuccess?.();
        } catch {
            toast.error('Failed to submit report');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setReason('');
        setDetails('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Report this content" maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Reason</label>
                    <div className="space-y-2">
                        {REPORT_REASONS.map((r) => (
                            <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="reason"
                                    value={r.value}
                                    checked={reason === r.value}
                                    onChange={() => setReason(r.value)}
                                    className="rounded-full border-border text-accent focus:ring-accent"
                                />
                                <span className="text-sm text-text-primary">{r.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Additional details (optional)</label>
                    <textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Provide more context for moderators..."
                        className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted resize-none focus:border-accent focus:outline-none"
                        rows={3}
                        maxLength={2000}
                    />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!reason || isSubmitting}
                        className="px-4 py-2 text-sm font-medium bg-danger/90 hover:bg-danger text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit report'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
