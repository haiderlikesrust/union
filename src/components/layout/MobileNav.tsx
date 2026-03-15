'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const navItems = [
    {
        label: 'Home',
        href: '/',
        icon: (active: boolean) => (
            <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        label: 'Search',
        href: '/search',
        icon: (active: boolean) => (
            <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
    },
    {
        label: 'Create',
        href: '/create',
        icon: () => (
            <div className="w-10 h-10 -mt-4 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </div>
        ),
        special: true,
    },
    {
        label: 'Alerts',
        href: '/notifications',
        icon: (active: boolean) => (
            <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        ),
    },
    {
        label: 'Messages',
        href: '/messages',
        icon: (active: boolean) => (
            <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
    },
    {
        label: 'Profile',
        href: '/profile',
        icon: (active: boolean) => (
            <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
];

export function MobileNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    if (!user) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary/95 backdrop-blur-xl border-t border-border md:hidden pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around h-16 min-h-[64px] px-1">
                {navItems.map((item) => {
                    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    const href = item.href === '/profile' && user ? `/user/${user.username}` : item.href;
                    return (
                        <Link
                            key={item.label}
                            href={href}
                            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 px-2 rounded-xl transition-colors active:scale-95 ${item.special ? '' : isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
                                }`}
                        >
                            {item.icon(isActive)}
                            {!item.special && (
                                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
