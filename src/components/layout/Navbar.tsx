'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/site-settings';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { formatNumber } from '@/lib/utils';

export function Navbar() {
    const { pb, user, logout, isAdmin } = useAuth();
    const { siteName, logoUrl } = useSiteSettings();
    const { theme, changeThemeWithAnimation, themes } = useTheme();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const themeMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
            if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
                setShowThemeMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUnreadCount = useCallback(() => {
        if (!user) { setUnreadCount(0); return; }
        pb.collection('notifications').getList(1, 1, {
            filter: `user = "${user.id}" && read = false`,
            requestKey: 'navbar-unread',
        }).then(res => setUnreadCount(res.totalItems ?? 0)).catch(() => setUnreadCount(0));
    }, [pb, user]);

    useEffect(() => {
        if (!user) { setUnreadCount(0); return; }
        let cancelled = false;
        pb.collection('notifications').getList(1, 1, {
            filter: `user = "${user.id}" && read = false`,
            requestKey: 'navbar-unread',
        }).then(res => {
            if (!cancelled) setUnreadCount(res.totalItems ?? 0);
        }).catch(() => { if (!cancelled) setUnreadCount(0); });
        return () => { cancelled = true; };
    }, [pb, user]);

    useEffect(() => {
        if (!user) return;
        const onFocus = () => fetchUnreadCount();
        const onNotificationsUpdated = () => fetchUnreadCount();
        window.addEventListener('focus', onFocus);
        window.addEventListener('notifications-updated', onNotificationsUpdated);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('notifications-updated', onNotificationsUpdated);
        };
    }, [user, fetchUnreadCount]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-secondary/95 backdrop-blur-xl border-b border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
                {logoUrl ? (
                    <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-sm text-white">
                        TU
                    </div>
                )}
                <span className="text-lg font-bold text-text-primary hidden sm:block">
                    {siteName}
                </span>
            </Link>

            {/* Search — on mobile: compact; tap to focus */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl min-w-0">
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder={`Search ${siteName}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 md:pl-10 md:pr-4 bg-bg-tertiary rounded-full text-sm text-text-primary placeholder:text-text-muted border border-border focus:border-accent focus:outline-none transition-colors"
                    />
                </div>
            </form>

            {/* Theme switcher — available to everyone */}
            <div className="relative shrink-0" ref={themeMenuRef}>
                <button
                    type="button"
                    onClick={() => setShowThemeMenu(!showThemeMenu)}
                    className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title="Change app theme"
                    aria-label="Change app theme"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                </button>
                {showThemeMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-bg-elevated border border-border rounded-xl shadow-2xl py-1 animate-fadeIn">
                        <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Theme</p>
                        {themes.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    changeThemeWithAnimation(t.id);
                                    setShowThemeMenu(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${theme === t.id ? 'text-accent bg-accent/10' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions — hide Create on mobile (it's in bottom nav) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {user ? (
                    <>
                        {/* Create Post — desktop only */}
                        <Link
                            href="/create"
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">Create</span>
                        </Link>

                        {/* Messages */}
                        <Link
                            href="/messages"
                            className="relative p-2 rounded-full hover:bg-bg-hover transition-colors"
                            title="Messages"
                        >
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </Link>
                        {/* Notifications */}
                        <Link
                            href="/notifications"
                            className="relative p-2 rounded-full hover:bg-bg-hover transition-colors"
                            title="Notifications"
                        >
                            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Link>

                        {/* User Menu */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-bg-hover transition-colors"
                            >
                                <Avatar user={user} size="sm" />
                                <span className="text-sm text-text-secondary hidden md:block max-w-[100px] truncate">
                                    {user.username}
                                </span>
                                <svg className="w-3 h-3 text-text-muted hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                                    <div className="p-4 border-b border-border">
                                        <p className="font-semibold text-text-primary">{user.username}</p>
                                        <p className="text-xs text-text-muted mt-1">
                                            <span className="text-accent font-medium">{formatNumber(user.karma || 0)}</span> karma
                                        </p>
                                    </div>
                                    <div className="py-1">
                                        <Link href={`/user/${user.username}`} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Profile
                                        </Link>
                                        <Link href="/messages" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            Messages
                                        </Link>
                                        <Link href="/saved" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            Saved Posts
                                        </Link>
                                        <Link href="/storage" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                            Cloud storage
                                        </Link>
                                        <Link href="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.065-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            Settings
                                        </Link>
                                        {isAdmin && (
                                            <Link href="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                Admin Panel
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => { logout(); setShowUserMenu(false); router.push('/'); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-bg-hover transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                            Log out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/signup"
                            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium transition-all hover:scale-[1.02]"
                        >
                            Sign up
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
}
