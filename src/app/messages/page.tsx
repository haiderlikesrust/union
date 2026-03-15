'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Conversation, DmMessage, User } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { timeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function MessagesPage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [lastMessages, setLastMessages] = useState<Record<string, DmMessage>>({});
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const convRes = await pb.collection('conversations').getList(1, 50, {
                sort: '-updated',
                expand: 'user1,user2',
            });
            const list = convRes.items as unknown as Conversation[];
            setConversations(list);

            if (list.length === 0) {
                setLastMessages({});
                return;
            }
            const convIds = list.map(c => c.id);
            const filter = convIds.map(id => `conversation = "${id}"`).join(' || ');
            const msgRes = await pb.collection('dm_messages').getFullList({
                filter,
                sort: '-created',
                expand: 'sender',
            });
            const messages = msgRes as unknown as DmMessage[];
            const byConv: Record<string, DmMessage> = {};
            for (const m of messages) {
                if (!byConv[m.conversation]) byConv[m.conversation] = m;
            }
            setLastMessages(byConv);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [pb, user]);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        load();
    }, [user, router, load]);

    const otherUser = (c: Conversation): User | null => {
        const u1 = c.expand?.user1;
        const u2 = c.expand?.user2;
        if (!u1 || !u2) return null;
        return (c.user1 === user?.id ? u2 : u1) as User;
    };

    const lastMsg = (c: Conversation) => lastMessages[c.id];
    const lastMsgText = (m: DmMessage | undefined) => {
        if (!m) return 'No messages yet';
        const raw = m.text || '';
        const text = raw === '[E2E]' ? '🔒 Encrypted message' : raw;
        return text.length > 60 ? text.slice(0, 60) + '…' : text;
    };

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-text-primary">Messages</h1>
                        <Link
                            href="/messages/new"
                            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-full transition-colors"
                        >
                            New message
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl border border-border">
                                    <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-2 min-w-0">
                                        <Skeleton className="w-32 h-4" />
                                        <Skeleton className="w-full h-3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : conversations.length > 0 ? (
                        <div className="space-y-1.5">
                            {conversations.map((c) => {
                                const other = otherUser(c);
                                const last = lastMsg(c);
                                return (
                                    <Link
                                        key={c.id}
                                        href={`/messages/${c.id}`}
                                        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                                    >
                                        <Avatar user={other || undefined} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-text-primary truncate">
                                                {other?.username ?? 'Unknown'}
                                            </p>
                                            <p className="text-sm text-text-muted truncate">
                                                {lastMsgText(last)}
                                            </p>
                                        </div>
                                        {last && (
                                            <span className="text-xs text-text-muted shrink-0">
                                                {timeAgo(last.created)}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState
                            title="No conversations yet"
                            description="Start a conversation from someone's profile or use New message."
                            action={
                                <Link
                                    href="/messages/new"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium"
                                >
                                    New message
                                </Link>
                            }
                        />
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
