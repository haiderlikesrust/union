'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { MentionTextarea } from '@/components/ui/MentionTextarea';
import toast from 'react-hot-toast';

interface CommentFormProps {
    postId: string;
    parentId?: string;
    onSubmit: () => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    /** When true, field and button are disabled (e.g. thread locked) */
    disabled?: boolean;
}

export function CommentForm({ postId, parentId, onSubmit, onCancel, autoFocus, disabled = false }: CommentFormProps) {
    const { pb, user } = useAuth();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const createNotification = async (targetUserId: string, type: 'reply' | 'mention', message: string, commentId?: string) => {
        if (targetUserId === user!.id) return;
        try {
            await pb.collection('notifications').create({
                user: targetUserId,
                type,
                sourceUser: user!.id,
                post: postId,
                comment: commentId || '',
                message,
                read: false,
            });
        } catch {
            // non-fatal
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (disabled || !content.trim() || !user) return;

        setIsSubmitting(true);
        try {
            const created = await pb.collection('comments').create({
                content: content.trim(),
                post: postId,
                author: user.id,
                parent: parentId || '',
                score: 0,
                isPinned: false,
            }) as { id: string };

            // Reply notification: notify parent comment author
            if (parentId) {
                try {
                    const parent = await pb.collection('comments').getOne(parentId, { fields: 'author' });
                    if (parent?.author) {
                        await createNotification(
                            parent.author as string,
                            'reply',
                            'replied to your comment',
                            created.id
                        );
                    }
                } catch {
                    // non-fatal
                }
            }

            // Mention notifications: find @username in content
            const mentionRegex = /@(\w+)/g;
            const usernames = [...new Set((content.match(mentionRegex) || []).map(m => m.slice(1)))];
            for (const username of usernames) {
                try {
                    const target = await pb.collection('users').getFirstListItem(`username = "${username}"`, { fields: 'id' });
                    if (target?.id) {
                        await createNotification(
                            target.id as string,
                            'mention',
                            `mentioned you in a comment`,
                            created.id
                        );
                    }
                } catch {
                    // user not found, skip
                }
            }

            setContent('');
            toast.success(parentId ? 'Reply posted' : 'Comment posted');
            onSubmit();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to post comment';
            toast.error(typeof msg === 'string' ? msg : 'Failed to post comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="p-4 bg-bg-tertiary rounded-xl border border-border text-center">
                <p className="text-sm text-text-muted">
                    <a href="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">Log in</a> to join the conversation
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-start gap-3">
                <Avatar user={user} size="sm" className="mt-1 hidden sm:block" />
                <div className="flex-1">
                    <MentionTextarea
                        value={content}
                        onChange={setContent}
                        placeholder={disabled ? 'This thread is locked. Only the Union bot and moderators can comment.' : (parentId ? 'Write a reply... (type @ to mention)' : 'What are your thoughts? (type @ to mention)')}
                        rows={parentId ? 2 : 3}
                        className="w-full p-3 bg-bg-tertiary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:border-accent focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        autoFocus={autoFocus}
                        disabled={disabled}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-text-muted">Markdown supported</p>
                        <div className="flex gap-2">
                            {onCancel && !disabled && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={disabled || !content.trim() || isSubmitting}
                                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmitting ? 'Posting...' : parentId ? 'Reply' : 'Comment'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
