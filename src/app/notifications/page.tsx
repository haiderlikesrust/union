'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Notification } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { timeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function NotificationsPage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) { router.push('/login'); return; }

        async function load() {
            try {
                const result = await pb.collection('notifications').getList(1, 50, {
                    filter: `user = "${user!.id}"`,
                    sort: '-created',
                    expand: 'sourceUser,post',
                });
                setNotifications(result.items as unknown as Notification[]);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [pb, user, router]);

    const markAsRead = async (id: string) => {
        try {
            await pb.collection('notifications').update(id, { read: true });
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('notifications-updated'));
        } catch { }
    };

    const markAllRead = async () => {
        const unread = notifications.filter(n => !n.read);
        await Promise.all(unread.map(n => pb.collection('notifications').update(n.id, { read: true })));
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('notifications-updated'));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'comment': return <span className="bg-bg-primary rounded-full p-[2px] inline-block shadow-sm"><svg className="w-[14px] h-[14px] text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></span>;
            case 'reply': return <span className="bg-bg-primary rounded-full p-[2px] inline-block shadow-sm"><svg className="w-[14px] h-[14px] text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></span>;
            case 'mention': return <span className="bg-bg-primary rounded-full p-[2px] inline-block shadow-sm"><svg className="w-[14px] h-[14px] text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg></span>;
            default: return <span className="bg-bg-primary rounded-full p-[2px] inline-block shadow-sm"><svg className="w-[14px] h-[14px] text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></span>;
        }
    };

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">Notifications</h1>
                        {notifications.some(n => !n.read) && (
                            <button
                                onClick={markAllRead}
                                className="text-sm text-accent hover:text-accent-hover transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl border border-border">
                                    <Skeleton className="w-10 h-10 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="w-3/4 h-4" />
                                        <Skeleton className="w-1/4 h-3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : notifications.length > 0 ? (
                        <div className="space-y-1.5">
                            {notifications.map(notif => {
                                const sourceUser = notif.expand?.sourceUser;
                                const post = notif.expand?.post;
                                return (
                                    <Link
                                        key={notif.id}
                                        href={notif.post ? `/post/${notif.post}` : '#'}
                                        onClick={() => !notif.read && markAsRead(notif.id)}
                                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${notif.read
                                            ? 'bg-bg-secondary border-border hover:bg-bg-tertiary'
                                            : 'bg-accent/5 border-accent/20 hover:bg-accent/10'
                                            }`}
                                    >
                                        <div className="relative shrink-0">
                                            <Avatar user={sourceUser || null} size="sm" />
                                            <span className="absolute -bottom-1 -right-1 text-xs">{getIcon(notif.type)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-text-primary">
                                                <span className="font-semibold">{sourceUser?.username || 'Someone'}</span>
                                                {' '}{notif.message || notif.type}
                                            </p>
                                            {post && (
                                                <p className="text-xs text-text-muted mt-0.5 truncate">
                                                    on &quot;{(post as any).title}&quot;
                                                </p>
                                            )}
                                            <p className="text-xs text-text-muted mt-1">{timeAgo(notif.created)}</p>
                                        </div>
                                        {!notif.read && (
                                            <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            title="No notifications"
                            description="When someone interacts with your content, you'll see it here."
                        />
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
