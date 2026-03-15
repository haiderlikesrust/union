'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    disabled?: boolean;
    minHeight?: string;
    autoFocus?: boolean;
}

interface UserOption {
    id: string;
    username: string;
    avatar?: string;
}

export function MentionTextarea({ value, onChange, placeholder, rows = 3, className = '', disabled, minHeight, autoFocus }: MentionTextareaProps) {
    const { pb } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [mentionStart, setMentionStart] = useState(0);
    const [filter, setFilter] = useState('');
    const [users, setUsers] = useState<UserOption[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserOption[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        if (users.length > 0) return;
        setLoading(true);
        try {
            const res = await pb.collection('users').getList(1, 150, {
                sort: 'username',
                fields: 'username,avatar',
            });
            const list = (res.items || []).map((u: { id: string; username: string; avatar?: string }) => ({
                id: u.id,
                username: u.username || '',
                avatar: u.avatar,
            })).filter((u: UserOption) => u.username);
            setUsers(list);
            setFilteredUsers(list);
        } catch {
            setUsers([]);
            setFilteredUsers([]);
        } finally {
            setLoading(false);
        }
    }, [pb, users.length]);

    useEffect(() => {
        if (!showMenu) return;
        setSelectedIndex(0);
        if (!filter) {
            setFilteredUsers(users.slice(0, 15));
            return;
        }
        const lower = filter.toLowerCase();
        const next = users.filter(u => u.username.toLowerCase().startsWith(lower) || u.username.toLowerCase().includes(lower));
        setFilteredUsers(next.slice(0, 10));
    }, [filter, showMenu, users]);

    const openMenu = useCallback((start: number) => {
        setMentionStart(start);
        setFilter('');
        setShowMenu(true);
        fetchUsers();
    }, [fetchUsers]);

    const closeMenu = useCallback(() => {
        setShowMenu(false);
        setFilter('');
        textareaRef.current?.focus();
    }, []);

    useEffect(() => {
        if (autoFocus && textareaRef.current) textareaRef.current.focus();
    }, [autoFocus]);

    const insertMention = useCallback((username: string) => {
        const text = value;
        const before = text.slice(0, mentionStart);
        const after = text.slice(textareaRef.current?.selectionStart ?? mentionStart);
        const next = before + '@' + username + ' ' + after;
        onChange(next);
        closeMenu();
        setTimeout(() => {
            textareaRef.current?.focus();
            const pos = mentionStart + username.length + 2;
            textareaRef.current?.setSelectionRange(pos, pos);
        }, 0);
    }, [value, mentionStart, onChange, closeMenu]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const v = e.target.value;
        const pos = e.target.selectionStart ?? 0;
        onChange(v);

        const textBeforeCursor = v.slice(0, pos);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        if (lastAt === -1) {
            setShowMenu(false);
            return;
        }
        const afterAt = textBeforeCursor.slice(lastAt + 1);
        if (/\s/.test(afterAt)) {
            setShowMenu(false);
            return;
        }
        openMenu(lastAt);
        setFilter(afterAt);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMenu || filteredUsers.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (i + 1) % filteredUsers.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
            return;
        }
        if (e.key === 'Enter' && filteredUsers[selectedIndex]) {
            e.preventDefault();
            insertMention(filteredUsers[selectedIndex].username);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
        }
    };

    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
                className={className}
                style={minHeight ? { minHeight } : undefined}
            />
            {showMenu && (
                <div
                    className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl border border-border bg-bg-elevated shadow-xl py-1"
                    style={{ top: '100%', left: 0 }}
                >
                    {loading ? (
                        <div className="px-3 py-2 text-sm text-text-muted">Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-muted">No users found</div>
                    ) : (
                        filteredUsers.map((u, i) => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => insertMention(u.username)}
                                onMouseEnter={() => setSelectedIndex(i)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${i === selectedIndex ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-bg-hover'}`}
                            >
                                <span className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-medium text-text-muted shrink-0">
                                    {u.username.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="font-medium">{u.username}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
