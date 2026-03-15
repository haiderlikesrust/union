'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Conversation, DmMessage, User } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { timeAgo } from '@/lib/utils';
import { ensureMyKeyPair, getSharedKey, encrypt, decrypt } from '@/lib/e2e';
import Link from 'next/link';
import toast from 'react-hot-toast';

const E2E_PLACEHOLDER = '[E2E]';

export default function ConversationPage() {
    const { id } = useParams<{ id: string }>();
    const { pb, user } = useAuth();
    const router = useRouter();
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [decryptedText, setDecryptedText] = useState<Record<string, string>>({});
    const [e2eReady, setE2eReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [text, setText] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const sharedKeyRef = useRef<CryptoKey | null>(null);

    const otherUser = conversation
        ? (conversation.user1 === user?.id
            ? (conversation.expand?.user2 as User)
            : (conversation.expand?.user1 as User))
        : null;

    const load = useCallback(async () => {
        if (!id || !user) return;
        try {
            const conv = await pb.collection('conversations').getOne(id, { expand: 'user1,user2' });
            setConversation(conv as unknown as Conversation);

            const list = await pb.collection('dm_messages').getFullList({
                filter: `conversation = "${id}"`,
                sort: 'created',
                expand: 'sender',
            });
            setMessages(list as unknown as DmMessage[]);
        } catch (err) {
            console.error(err);
            setConversation(null);
            setMessages([]);
        } finally {
            setIsLoading(false);
        }
    }, [pb, id, user]);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        load();
    }, [user, router, load]);

    // E2E: ensure my keys, sync public key to server, get shared key for this conversation
    useEffect(() => {
        if (!user || !otherUser || !id) return;
        let cancelled = false;
        (async () => {
            try {
                const { publicKey } = await ensureMyKeyPair(user.id);
                const me = await pb.collection('users').getOne(user.id);
                const existing = (me as any).e2ePublicKey;
                if (existing !== publicKey) {
                    await pb.collection('users').update(user.id, { e2ePublicKey: publicKey });
                }
                if (otherUser.e2ePublicKey) {
                    const key = await getSharedKey(user.id, otherUser.e2ePublicKey, `conv_${id}`);
                    if (!cancelled && key) {
                        sharedKeyRef.current = key;
                        setE2eReady(true);
                    }
                } else {
                    setE2eReady(true);
                }
            } catch (e) {
                if (!cancelled) setE2eReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, [pb, user, otherUser, id]);

    // Decrypt messages that have ciphertext
    useEffect(() => {
        if (!e2eReady || !sharedKeyRef.current || messages.length === 0) return;
        const key = sharedKeyRef.current;
        const toDecrypt = messages.filter((m) => m.ciphertext && m.nonce);
        if (toDecrypt.length === 0) return;
        let cancelled = false;
        const next: Record<string, string> = {};
        Promise.all(
            toDecrypt.map(async (m) => {
                if (cancelled) return;
                try {
                    const plain = await decrypt(key, m.ciphertext!, m.nonce!);
                    next[m.id] = plain;
                } catch {
                    next[m.id] = '[Unable to decrypt]';
                }
            })
        ).then(() => {
            if (!cancelled) setDecryptedText((prev) => ({ ...prev, ...next }));
        });
        return () => { cancelled = true; };
    }, [e2eReady, messages]);

    useEffect(() => {
        if (!user) return;
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, user]);

    // Realtime: when a new message is added for this conversation, add it to the list
    useEffect(() => {
        if (!id || !pb) return;
        let unsub: (() => void) | null = null;
        pb.realtime.subscribe('dm_messages', (e) => {
            if (e.action === 'create' && (e.record as any)?.conversation === id) {
                setMessages((prev) => {
                    const rec = e.record as any;
                    if (prev.some((m) => m.id === rec.id)) return prev;
                    return [...prev, rec as DmMessage];
                });
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        }).then((fn) => { unsub = fn; unsubscribeRef.current = fn; }).catch(() => {});
        return () => {
            const fn = unsubscribeRef.current;
            if (fn) { fn(); unsubscribeRef.current = null; }
        };
    }, [pb, id]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || !conversation || !user || sending) return;
        setSending(true);
        try {
            const key = sharedKeyRef.current;
            const useE2e = e2eReady && otherUser?.e2ePublicKey && key;
            if (useE2e && key) {
                const { ciphertext: ct, nonce: n } = await encrypt(key, trimmed);
                await pb.collection('dm_messages').create({
                    conversation: conversation.id,
                    sender: user.id,
                    text: E2E_PLACEHOLDER,
                    ciphertext: ct,
                    nonce: n,
                });
            } else {
                await pb.collection('dm_messages').create({
                    conversation: conversation.id,
                    sender: user.id,
                    text: trimmed,
                });
            }
            setText('');
            await load();
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const displayText = (m: DmMessage): string => {
        if (m.ciphertext && m.nonce && decryptedText[m.id] !== undefined) return decryptedText[m.id];
        if (m.text === E2E_PLACEHOLDER) return '…';
        return m.text;
    };

    if (!user) return null;

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="pt-14 pb-24">
                    <div className="max-w-2xl mx-auto px-4 py-4">
                        <div className="flex items-center gap-3 mb-6">
                            <Skeleton className="w-12 h-12 rounded-full" />
                            <Skeleton className="w-32 h-6" />
                        </div>
                        <div className="space-y-4">
                            {[...Array(8)].map((_, i) => (
                                <Skeleton key={i} className="h-14 rounded-xl w-3/4" />
                            ))}
                        </div>
                    </div>
                </main>
            </>
        );
    }

    if (!conversation) {
        return (
            <>
                <Navbar />
                <main className="pt-14 pb-24">
                    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
                        <p className="text-text-muted mb-4">Conversation not found or you don&apos;t have access.</p>
                        <Link href="/messages" className="text-accent hover:text-accent-hover">
                            Back to Messages
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-24 flex flex-col h-[calc(100vh-3.5rem)]">
                <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 px-4">
                    {/* Header */}
                    <div className="flex items-center gap-3 py-4 border-b border-border shrink-0">
                        <Link href="/messages" className="p-1 -ml-1 rounded-full hover:bg-bg-hover transition-colors">
                            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <Avatar user={otherUser || undefined} size="md" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="font-semibold text-text-primary truncate">{otherUser?.username ?? 'Unknown'}</h1>
                                {otherUser?.e2ePublicKey && (
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/40" title="End-to-end encrypted">
                                        Encrypted
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-text-muted">Direct message</p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-center text-text-muted text-sm py-8">No messages yet. Say hi!</p>
                        ) : (
                            messages.map((m) => {
                                const isMe = m.sender === user.id;
                                const sender = m.expand?.sender as User | undefined;
                                return (
                                    <div
                                        key={m.id}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                                isMe
                                                    ? 'bg-accent text-white rounded-br-md'
                                                    : 'bg-bg-secondary border border-border rounded-bl-md'
                                            }`}
                                        >
                                            {!isMe && sender && (
                                                <p className="text-xs font-medium text-accent mb-0.5">{sender.username}</p>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap break-words">{displayText(m)}</p>
                                            <p className={`text-[10px] mt-1 ${isMe ? 'text-white/80' : 'text-text-muted'}`}>
                                                {timeAgo(m.created)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="py-4 border-t border-border shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Write a message..."
                                className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none text-sm"
                                maxLength={10000}
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !text.trim()}
                                className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            </main>
            <MobileNav />
        </>
    );
}
