'use client';

import Link from 'next/link';
import { SortType, TopTimeFilter, CommunityRule, User } from '@/lib/types';
import { FLAIR_OPTIONS } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { useSiteSettings } from '@/lib/site-settings';

interface SidebarProps {
    currentSort?: SortType;
    onSortChange?: (sort: SortType) => void;
    topTimeFilter?: TopTimeFilter;
    onTopTimeFilterChange?: (filter: TopTimeFilter) => void;
    /** Community rules (from community_rules collection) */
    rules?: CommunityRule[];
    /** Users with role admin or moderator */
    moderators?: User[];
}

const SORT_OPTIONS: { value: SortType; label: string; icon: React.ReactNode }[] = [
    { value: 'hot', label: 'Hot', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg> },
    { value: 'new', label: 'New', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg> },
    { value: 'rising', label: 'Rising', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
    { value: 'top', label: 'Top', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v1a7 7 0 0014 0V3M5 3h14M5 3a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2M9 13v7m-2 0h6" /></svg> },
    { value: 'controversial', label: 'Controversial', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg> },
];

const TIME_FILTER_OPTIONS: { value: TopTimeFilter; label: string }[] = [
    { value: 'hour', label: 'Past hour' },
    { value: 'day', label: 'Past 24 hours' },
    { value: 'week', label: 'Past week' },
    { value: 'month', label: 'Past month' },
    { value: 'year', label: 'Past year' },
    { value: 'all', label: 'All time' },
];

export function Sidebar({ currentSort = 'hot', onSortChange, topTimeFilter = 'day', onTopTimeFilterChange, rules = [], moderators = [] }: SidebarProps) {
    const { siteName, logoUrl, bannerUrl } = useSiteSettings();
    return (
        <aside className="hidden lg:block w-72 shrink-0 space-y-4">
            {/* Community Info Card */}
            <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
                {bannerUrl ? (
                    <div className="h-20 relative">
                        <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="h-20 bg-gradient-to-r from-accent via-purple-600 to-pink-600" />
                )}
                <div className="p-4">
                    <div className="flex items-center gap-2 -mt-8 mb-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-12 h-12 rounded-full border-4 border-bg-secondary object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-purple-500 border-4 border-bg-secondary flex items-center justify-center font-bold text-white text-lg">
                                TU
                            </div>
                        )}
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">{siteName}</h2>
                    <p className="text-xs text-text-muted mt-1">Where the internet gathers to argue, create, and vibe.</p>
                    <div className="flex gap-4 mt-3 text-xs text-text-secondary">
                        <div>
                            <span className="font-semibold text-text-primary">∞</span> Members
                        </div>
                        <div>
                            <span className="font-semibold text-success">●</span> Online
                        </div>
                    </div>
                </div>
            </div>

            {/* Sort Options */}
            {onSortChange && (
                <div className="bg-bg-secondary rounded-xl border border-border p-3">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Sort by</h3>
                    <div className="space-y-0.5">
                        {SORT_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => onSortChange(opt.value)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${currentSort === opt.value
                                    ? 'bg-accent/10 text-accent font-medium'
                                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                                    }`}
                            >
                                <span>{opt.icon}</span>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {(currentSort === 'top' || currentSort === 'controversial') && onTopTimeFilterChange && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Time</h3>
                            <div className="flex flex-wrap gap-1">
                                {TIME_FILTER_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onTopTimeFilterChange(opt.value)}
                                        className={`px-2 py-1 rounded-lg text-xs transition-all ${topTimeFilter === opt.value
                                            ? 'bg-accent/10 text-accent font-medium'
                                            : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Rules */}
            {rules.length > 0 && (
                <div className="bg-bg-secondary rounded-xl border border-border p-3">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Rules</h3>
                    <ol className="space-y-2">
                        {rules
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                            .map((rule, i) => (
                                <li key={rule.id} className="flex gap-2 text-sm">
                                    <span className="text-text-muted shrink-0">{i + 1}.</span>
                                    <div>
                                        <span className="text-text-primary font-medium">{rule.title}</span>
                                        {rule.description && (
                                            <p className="text-xs text-text-muted mt-0.5">{rule.description}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                    </ol>
                </div>
            )}

            {/* Moderators */}
            {moderators.length > 0 && (
                <div className="bg-bg-secondary rounded-xl border border-border p-3">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Moderators</h3>
                    <a
                        href="mailto:mods@theunion.com"
                        className="block w-full text-center py-2 mb-3 text-sm font-medium text-accent hover:text-accent-hover border border-border rounded-lg hover:bg-bg-hover transition-colors"
                    >
                        Message Mods
                    </a>
                    <ul className="space-y-2">
                        {moderators.map((mod) => (
                            <li key={mod.id}>
                                <Link
                                    href={`/user/${mod.username}`}
                                    className="flex items-center gap-2 py-1 rounded-lg hover:bg-bg-hover transition-colors"
                                >
                                    <Avatar user={mod} size="xs" />
                                    <span className="text-sm font-medium text-text-primary truncate">u/{mod.username}</span>
                                    {mod.role === 'admin' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium shrink-0">Admin</span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Flairs */}
            <div className="bg-bg-secondary rounded-xl border border-border p-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Flairs</h3>
                <div className="flex flex-wrap gap-1.5 px-1">
                    {FLAIR_OPTIONS.map((flair) => (
                        <Link
                            key={flair.value}
                            href={`/search?flair=${flair.value}`}
                            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:scale-[1.05]"
                            style={{ backgroundColor: flair.color + '20', color: flair.color }}
                        >
                            {flair.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="px-3 text-[11px] text-text-muted">
                <p>{siteName} © {new Date().getFullYear()}</p>
                <p className="mt-1">Built for the internet. By the internet.</p>
            </div>
        </aside>
    );
}
