'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { getRecordFileUrl } from '@/lib/pocketbase';
import { useRouter } from 'next/navigation';
import { Post, Report, User, Ban, Badge, CommunityRule, SiteSettings } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { useSiteSettings } from '@/lib/site-settings';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo, formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';

type AdminTab = 'overview' | 'reports' | 'users' | 'posts' | 'badges' | 'bot' | 'rules' | 'branding';

export default function AdminPage() {
    const { pb, user, isAdmin } = useAuth();
    const { refresh: refreshSiteSettings } = useSiteSettings();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [tab, setTab] = useState<AdminTab>('overview');
    const [reports, setReports] = useState<Report[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [bans, setBans] = useState<Ban[]>([]);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [rules, setRules] = useState<CommunityRule[]>([]);
    const [stats, setStats] = useState({ posts: 0, users: 0, comments: 0, reports: 0 });
    const [isLoading, setIsLoading] = useState(true);

    // Badge creation state
    const [newBadgeName, setNewBadgeName] = useState('');
    const [newBadgeDesc, setNewBadgeDesc] = useState('');
    const [newBadgeImage, setNewBadgeImage] = useState<File | null>(null);
    const [newBadgePreview, setNewBadgePreview] = useState<string | null>(null);
    const [isCreatingBadge, setIsCreatingBadge] = useState(false);

    // Bot profile edit state
    const [botProfileName, setBotProfileName] = useState('');
    const [botProfileBio, setBotProfileBio] = useState('');
    const [botProfileAvatar, setBotProfileAvatar] = useState<File | null>(null);
    const [botProfileBanner, setBotProfileBanner] = useState<File | null>(null);
    const [botProfileAvatarPreview, setBotProfileAvatarPreview] = useState<string | null>(null);
    const [botProfileBannerPreview, setBotProfileBannerPreview] = useState<string | null>(null);
    const [isSavingBotProfile, setIsSavingBotProfile] = useState(false);
    const botAvatarInputRef = useRef<HTMLInputElement>(null);
    const botBannerInputRef = useRef<HTMLInputElement>(null);

    // Rules state
    const [newRuleOrder, setNewRuleOrder] = useState(1);
    const [newRuleTitle, setNewRuleTitle] = useState('');
    const [newRuleDescription, setNewRuleDescription] = useState('');
    const [isSavingRule, setIsSavingRule] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    // Branding (site logo, banner, name)
    const [siteSettingsRecord, setSiteSettingsRecord] = useState<SiteSettings | null>(null);
    const [brandingSiteName, setBrandingSiteName] = useState('');
    const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null);
    const [brandingBannerFile, setBrandingBannerFile] = useState<File | null>(null);
    const [brandingLogoPreview, setBrandingLogoPreview] = useState<string | null>(null);
    const [brandingBannerPreview, setBrandingBannerPreview] = useState<string | null>(null);
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const brandingLogoInputRef = useRef<HTMLInputElement>(null);
    const brandingBannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) { router.push('/login'); return; }
        if (!isAdmin) { router.push('/'); toast.error('Admin access only'); return; }

        async function load() {
            try {
                const [postsRes, usersRes, commentsRes, reportsRes, bansRes, badgesRes, rulesRes, siteSettingsRes] = await Promise.all([
                    pb.collection('posts').getList(1, 50, { sort: '-created', expand: 'author,author.badges,badges' }),
                    pb.collection('users').getList(1, 100, { sort: '-created', expand: 'badges' }),
                    pb.collection('comments').getList(1, 1),
                    pb.collection('reports').getList(1, 50, { sort: '-created', expand: 'reporter' }),
                    pb.collection('bans').getList(1, 50, { expand: 'user,bannedBy' }),
                    pb.collection('badges').getList(1, 50, { sort: '-created' }),
                    pb.collection('community_rules').getFullList({ sort: 'order' }).catch(() => ({ items: [] })),
                    pb.collection('site_settings').getList(1, 1).catch(() => ({ items: [] })),
                ]);

                setPosts(postsRes.items as unknown as Post[]);
                setUsers(usersRes.items as unknown as User[]);
                setReports(reportsRes.items as unknown as Report[]);
                setBans(bansRes.items as unknown as Ban[]);
                setBadges(badgesRes.items as unknown as Badge[]);
                setRules((rulesRes as { items?: CommunityRule[] }).items ?? []);
                const siteRec = (siteSettingsRes as { items?: unknown[] }).items?.[0] as SiteSettings | undefined;
                setSiteSettingsRecord(siteRec ?? null);
                setBrandingSiteName(siteRec?.siteName?.trim() ?? 'The Union');
                setStats({
                    posts: postsRes.totalItems,
                    users: usersRes.totalItems,
                    comments: commentsRes.totalItems,
                    reports: reportsRes.totalItems,
                });
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [pb, user, isAdmin, router]);

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Delete this post? It will show as "[deleted post]" instead of being removed.')) return;
        try {
            await pb.collection('posts').update(postId, {
                isDeleted: true,
                title: '[deleted]',
                body: '',
                url: '',
            });
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, isDeleted: true, title: '[deleted]', body: '', url: '' } : p));
            toast.success('Post deleted');
        } catch {
            toast.error('Failed to delete post');
        }
    };

    const handlePinPost = async (postId: string, isPinned: boolean) => {
        try {
            await pb.collection('posts').update(postId, { isPinned: !isPinned });
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, isPinned: !isPinned } : p));
            toast.success(isPinned ? 'Post unpinned' : 'Post pinned');
        } catch {
            toast.error('Failed to update post');
        }
    };

    const handleLockPost = async (postId: string, isLocked: boolean) => {
        try {
            await pb.collection('posts').update(postId, { isLocked: !isLocked });
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLocked: !isLocked } : p));
            toast.success(isLocked ? 'Post unlocked' : 'Post locked');
        } catch {
            toast.error('Failed to update lock state');
        }
    };

    const handleBanUser = async (userId: string) => {
        const reason = prompt('Ban reason:');
        if (!reason) return;
        try {
            await pb.collection('bans').create({
                user: userId,
                reason,
                bannedBy: user!.id,
                expiresAt: '',
            });
            toast.success('User banned');
        } catch {
            toast.error('Failed to ban user');
        }
    };

    const handleDismissReport = async (reportId: string) => {
        const report = reports.find(r => r.id === reportId);
        try {
            await pb.collection('reports').update(reportId, { status: 'dismissed' });
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' as const } : r));
            if (report?.reporter) {
                await pb.collection('notifications').create({
                    user: report.reporter,
                    type: 'system',
                    sourceUser: user?.id || '',
                    post: '',
                    comment: '',
                    message: 'Your report was dismissed by the moderation team.',
                    read: false,
                }).catch(() => null);
            }
            toast.success('Report dismissed');
        } catch {
            toast.error('Failed to dismiss report');
        }
    };

    const handleReviewReport = async (reportId: string) => {
        const report = reports.find(r => r.id === reportId);
        try {
            await pb.collection('reports').update(reportId, { status: 'reviewed' });
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'reviewed' as const } : r));
            if (report?.reporter) {
                await pb.collection('notifications').create({
                    user: report.reporter,
                    type: 'system',
                    sourceUser: user?.id || '',
                    post: '',
                    comment: '',
                    message: 'Your report was reviewed. Thanks for helping keep the community safe.',
                    read: false,
                }).catch(() => null);
            }
            toast.success('Report marked reviewed');
        } catch {
            toast.error('Failed to update report');
        }
    };

    const handleChangeRole = async (userId: string, role: string) => {
        try {
            await pb.collection('users').update(userId, { role });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as User['role'] } : u));
            toast.success(`Role updated to ${role}`);
        } catch {
            toast.error('Failed to update role');
        }
    };

    const handleAwardBadge = async (userId: string, badgeId: string) => {
        if (!badgeId) return;
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;

        const currentBadges = targetUser.badges || [];
        if (currentBadges.includes(badgeId)) {
            toast.error('User already has this badge');
            return;
        }

        const newBadges = [...currentBadges, badgeId];
        try {
            const updatedUser = await pb.collection('users').update(userId, { badges: newBadges }, { expand: 'badges' });
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser as unknown as User : u));
            toast.success('Badge awarded!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to award badge');
        }
    };

    const handleRemoveBadge = async (userId: string, badgeId: string) => {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;

        const currentBadges = targetUser.badges || [];
        const newBadges = currentBadges.filter(id => id !== badgeId);

        if (!confirm('Remove badge from user?')) return;

        try {
            const updatedUser = await pb.collection('users').update(userId, { badges: newBadges }, { expand: 'badges' });
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser as unknown as User : u));
            toast.success('Badge removed!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to remove badge');
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5MB');
            return;
        }
        setNewBadgeImage(file);
        const reader = new FileReader();
        reader.onload = (ev) => setNewBadgePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleCreateBadge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBadgeName.trim() || !newBadgeImage) {
            toast.error('Name and image are required');
            return;
        }

        setIsCreatingBadge(true);
        try {
            const formData = new FormData();
            formData.append('name', newBadgeName.trim());
            formData.append('description', newBadgeDesc.trim());
            formData.append('image', newBadgeImage);

            const record = await pb.collection('badges').create(formData);
            setBadges(prev => [record as unknown as Badge, ...prev]);

            // Reset form
            setNewBadgeName('');
            setNewBadgeDesc('');
            setNewBadgeImage(null);
            setNewBadgePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            toast.success('Badge created successfully!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to create badge');
        } finally {
            setIsCreatingBadge(false);
        }
    };

    const handleDeleteBadge = async (badgeId: string) => {
        if (!confirm('Are you sure you want to delete this badge completely? Users who have it will lose it.')) return;
        try {
            await pb.collection('badges').delete(badgeId);
            setBadges(prev => prev.filter(b => b.id !== badgeId));
            toast.success('Badge deleted');
        } catch {
            toast.error('Failed to delete badge');
        }
    };

    const botUsers = users.filter(u => u.role === 'bot');
    const selectedBot = botUsers[0] ?? null;

    useEffect(() => {
        if (tab === 'bot' && selectedBot) {
            setBotProfileName(selectedBot.name ?? '');
            setBotProfileBio(selectedBot.bio ?? '');
            setBotProfileAvatar(null);
            setBotProfileBanner(null);
            setBotProfileAvatarPreview(null);
            setBotProfileBannerPreview(null);
        }
    }, [tab, selectedBot?.id]);

    const handleBotAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBotProfileAvatar(file);
        const reader = new FileReader();
        reader.onload = (ev) => setBotProfileAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleBotBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBotProfileBanner(file);
        const reader = new FileReader();
        reader.onload = (ev) => setBotProfileBannerPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRuleTitle.trim()) return;
        setIsSavingRule(true);
        try {
            const created = await pb.collection('community_rules').create({
                order: newRuleOrder,
                title: newRuleTitle.trim(),
                description: newRuleDescription.trim(),
            });
            setRules(prev => [...prev, created as unknown as CommunityRule].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            setNewRuleTitle('');
            setNewRuleDescription('');
            setNewRuleOrder(prev => prev + 1);
            toast.success('Rule added');
        } catch (err) {
            console.error(err);
            toast.error('Failed to add rule');
        } finally {
            setIsSavingRule(false);
        }
    };

    const handleUpdateRule = async (id: string, order: number, title: string, description: string) => {
        try {
            await pb.collection('community_rules').update(id, { order, title, description });
            setRules(prev => prev.map(r => r.id === id ? { ...r, order, title, description } : r).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            setEditingRuleId(null);
            toast.success('Rule updated');
        } catch {
            toast.error('Failed to update rule');
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Delete this rule?')) return;
        try {
            await pb.collection('community_rules').delete(id);
            setRules(prev => prev.filter(r => r.id !== id));
            toast.success('Rule deleted');
        } catch {
            toast.error('Failed to delete rule');
        }
    };

    const handleSaveBranding = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingBranding(true);
        try {
            const formData = new FormData();
            formData.append('siteName', brandingSiteName.trim() || 'The Union');
            if (brandingLogoFile) formData.append('logo', brandingLogoFile);
            if (brandingBannerFile) formData.append('banner', brandingBannerFile);
            if (siteSettingsRecord) {
                await pb.collection('site_settings').update(siteSettingsRecord.id, formData);
            } else {
                const created = await pb.collection('site_settings').create(formData);
                setSiteSettingsRecord(created as unknown as SiteSettings);
            }
            await refreshSiteSettings();
            setBrandingLogoFile(null);
            setBrandingBannerFile(null);
            setBrandingLogoPreview(null);
            setBrandingBannerPreview(null);
            toast.success('Branding updated');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save branding');
        } finally {
            setIsSavingBranding(false);
        }
    };

    const handleSaveBotProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBot) return;
        setIsSavingBotProfile(true);
        try {
            const formData = new FormData();
            formData.append('name', botProfileName.trim());
            formData.append('bio', botProfileBio.trim());
            if (botProfileAvatar) formData.append('avatar', botProfileAvatar);
            if (botProfileBanner) formData.append('banner', botProfileBanner);
            await pb.collection('users').update(selectedBot.id, formData);
            const updated = await pb.collection('users').getList(1, 100, { expand: 'badges' });
            setUsers(updated.items as unknown as User[]);
            setBotProfileAvatar(null);
            setBotProfileBanner(null);
            setBotProfileAvatarPreview(null);
            setBotProfileBannerPreview(null);
            if (botAvatarInputRef.current) botAvatarInputRef.current.value = '';
            if (botBannerInputRef.current) botBannerInputRef.current.value = '';
            toast.success('Bot profile updated');
        } catch (err: unknown) {
            console.error(err);
            const status = (err as { status?: number })?.status;
            const msg = (err as { message?: string })?.message ?? '';
            if (status === 403 || status === 404 || msg.includes('not found')) {
                toast.error(
                    'Cannot update bot profile. In PocketBase Admin, set the users collection Update rule to: @request.auth.id = id || @request.auth.role = \'admin\' — or re-run: node setup-pb.js <admin-email> <password>'
                );
            } else {
                toast.error('Failed to update bot profile');
            }
        } finally {
            setIsSavingBotProfile(false);
        }
    };

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="pt-14 flex items-center justify-center min-h-screen">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-8">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Total Posts', value: stats.posts, color: 'text-accent' },
                            { label: 'Total Users', value: stats.users, color: 'text-success' },
                            { label: 'Total Comments', value: stats.comments, color: 'text-warning' },
                            { label: 'Reports', value: stats.reports, color: 'text-danger' },
                        ].map(s => (
                            <div key={s.label} className="p-4 bg-bg-secondary rounded-xl border border-border">
                                <p className="text-xs text-text-muted uppercase tracking-wider">{s.label}</p>
                                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{formatNumber(s.value)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border mb-6 overflow-x-auto">
                        {(['overview', 'reports', 'users', 'bot', 'posts', 'badges', 'rules', 'branding'] as AdminTab[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-all capitalize whitespace-nowrap ${tab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {tab === 'overview' && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Recent Posts */}
                            <div className="bg-bg-secondary rounded-xl border border-border p-4">
                                <h3 className="font-semibold mb-3">Recent Posts</h3>
                                <div className="space-y-2">
                                    {posts.slice(0, 5).map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-hover transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <Link href={`/post/${p.id}`} className="text-sm font-medium text-text-primary hover:text-accent truncate block">
                                                    {p.title}
                                                </Link>
                                                <p className="text-xs text-text-muted">{timeAgo(p.created)}</p>
                                            </div>
                                            <span className="text-xs text-text-muted ml-2">{p.score} pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recent Reports */}
                            <div className="bg-bg-secondary rounded-xl border border-border p-4">
                                <h3 className="font-semibold mb-3">Pending Reports</h3>
                                {reports.filter(r => r.status === 'pending').length > 0 ? (
                                    <div className="space-y-2">
                                        {reports.filter(r => r.status === 'pending').slice(0, 5).map(r => (
                                            <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-danger/5 border border-danger/10">
                                                <div>
                                                    <p className="text-sm text-text-primary">{r.reason}</p>
                                                    <p className="text-xs text-text-muted">{r.targetType} • {timeAgo(r.created)}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleReviewReport(r.id)}
                                                        className="text-xs text-success hover:text-success/80 px-2 py-1 rounded bg-bg-tertiary"
                                                    >
                                                        Review
                                                    </button>
                                                    <button
                                                        onClick={() => handleDismissReport(r.id)}
                                                        className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded bg-bg-tertiary"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="flex items-center justify-center gap-2 text-sm text-text-muted p-4 text-center">
                                        No pending reports
                                        <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'reports' && (
                        <div className="space-y-2">
                            {reports.length > 0 ? (
                                reports.map(r => (
                                    <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border ${r.status === 'pending' ? 'bg-danger/5 border-danger/20' : 'bg-bg-secondary border-border'
                                        }`}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${r.status === 'pending' ? 'bg-danger/10 text-danger' : 'bg-bg-tertiary text-text-muted'
                                                    }`}>
                                                    {r.status}
                                                </span>
                                                <span className="text-sm font-medium">{r.reason}</span>
                                            </div>
                                            <p className="text-xs text-text-muted mt-1">
                                                {r.targetType} • Reported by {r.expand?.reporter?.username || 'unknown'} • {timeAgo(r.created)}
                                            </p>
                                        </div>
                                        {r.status === 'pending' && (
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => handleReviewReport(r.id)}>
                                                    Review
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDismissReport(r.id)}>
                                                    Dismiss
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <EmptyState title="No reports" description="The community is behaving!" />
                            )}
                        </div>
                    )}

                    {tab === 'users' && (
                        <div className="space-y-4">
                            {users.map(u => (
                                <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-bg-secondary rounded-xl border border-border gap-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar user={u} size="md" />
                                        <div>
                                            <Link href={`/user/${u.username}`} className="font-medium text-text-primary hover:text-accent transition-colors flex items-center gap-2">
                                                {u.username}
                                                {u.expand?.badges?.map(b => (
                                                    <img
                                                        key={b.id}
                                                        src={getRecordFileUrl(b, b.image)}
                                                        alt={b.name}
                                                        title={b.name}
                                                        className="w-4 h-4 rounded-sm object-cover cursor-pointer"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleRemoveBadge(u.id, b.id);
                                                        }}
                                                    />
                                                ))}
                                            </Link>
                                            <p className="text-xs text-text-muted mt-1">
                                                {u.role} • {formatNumber(u.karma || 0)} karma • joined {timeAgo(u.created)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            title="Award Badge"
                                            value=""
                                            onChange={(e) => handleAwardBadge(u.id, e.target.value)}
                                            className="px-2 py-1 text-xs bg-bg-tertiary border border-border rounded-lg text-text-primary w-32"
                                        >
                                            <option value="" disabled>Award Badge...</option>
                                            {badges.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                            className="px-2 py-1 text-xs bg-accent/10 border border-accent/20 rounded-lg text-accent w-24"
                                        >
                                            <option value="user">User</option>
                                            <option value="moderator">Mod</option>
                                            <option value="admin">Admin</option>
                                            <option value="bot">Bot</option>
                                        </select>
                                        <button
                                            onClick={() => handleBanUser(u.id)}
                                            className="px-3 py-1 text-xs text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors"
                                        >
                                            Ban
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'posts' && (
                        <div className="space-y-4">
                            {posts.map(p => (
                                <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-bg-secondary rounded-xl border border-border gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {p.isPinned && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success uppercase tracking-wider">Pinned</span>
                                            )}
                                            {p.isLocked && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning uppercase tracking-wider">Locked</span>
                                            )}
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bg-tertiary text-text-muted uppercase tracking-wider">{p.type}</span>
                                        </div>
                                        <Link href={`/post/${p.id}`} className="font-medium text-text-primary hover:text-accent transition-colors truncate block">
                                            {p.title}
                                        </Link>
                                        <p className="text-xs text-text-muted mt-1">
                                            by {p.expand?.author?.username || 'unknown'} • {p.score} pts • {p.commentCount} comments • {timeAgo(p.created)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Link
                                            href={`/post/${p.id}`}
                                            className="px-3 py-1 text-xs bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => handlePinPost(p.id, p.isPinned)}
                                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${p.isPinned ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-accent/10 text-accent hover:bg-accent/20'
                                                }`}
                                        >
                                            {p.isPinned ? 'Unpin' : 'Pin'}
                                        </button>
                                        <button
                                            onClick={() => handleDeletePost(p.id)}
                                            className="px-3 py-1 text-xs text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => handleLockPost(p.id, !!p.isLocked)}
                                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${p.isLocked ? 'bg-warning/15 text-warning hover:bg-warning/25' : 'bg-warning/10 text-warning hover:bg-warning/20'}`}
                                        >
                                            {p.isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'badges' && (
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Create Badge Form */}
                            <div className="md:col-span-1">
                                <div className="bg-bg-secondary border border-border rounded-xl p-5 sticky top-20">
                                    <h3 className="font-bold text-lg mb-4">Create New Badge</h3>
                                    <form onSubmit={handleCreateBadge} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Image</label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageSelect}
                                                className="hidden"
                                            />
                                            {newBadgePreview ? (
                                                <div className="flex flex-col gap-2">
                                                    <img src={newBadgePreview} alt="Preview" className="w-16 h-16 object-contain bg-black/20 rounded-lg border border-border" />
                                                    <button type="button" onClick={() => { setNewBadgePreview(null); setNewBadgeImage(null); }} className="text-xs text-danger text-left hover:underline">Remove Image</button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full py-4 border-2 border-dashed border-border rounded-lg text-text-muted hover:border-accent hover:text-accent transition-all text-sm flex flex-col items-center gap-1"
                                                >
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    Upload Badge
                                                </button>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Name</label>
                                            <input
                                                type="text"
                                                value={newBadgeName}
                                                onChange={e => setNewBadgeName(e.target.value)}
                                                placeholder="e.g. VIP Member"
                                                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:border-accent focus:outline-none"
                                                maxLength={100}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description</label>
                                            <input
                                                type="text"
                                                value={newBadgeDesc}
                                                onChange={e => setNewBadgeDesc(e.target.value)}
                                                placeholder="Optional explanation"
                                                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:border-accent focus:outline-none"
                                                maxLength={500}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isCreatingBadge || !newBadgeName || !newBadgeImage}
                                            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isCreatingBadge ? 'Creating...' : 'Create Badge'}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Badge List */}
                            <div className="md:col-span-2 space-y-3">
                                <h3 className="font-bold text-lg mb-4">Existing Badges</h3>
                                {badges.length === 0 ? (
                                    <div className="p-8 border border-border rounded-xl bg-bg-secondary text-center">
                                        <p className="text-text-muted">No badges created yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {badges.map(badge => (
                                            <div key={badge.id} className="bg-bg-secondary border border-border rounded-xl p-4 flex items-center justify-between gap-4 transition-all hover:border-border-light">
                                                <div className="flex items-center gap-4">
                                                    <img
                                                        src={getRecordFileUrl(badge, badge.image)}
                                                        alt={badge.name}
                                                        className="w-12 h-12 rounded object-cover bg-bg-tertiary"
                                                    />
                                                    <div>
                                                        <h4 className="font-semibold text-text-primary text-sm">{badge.name}</h4>
                                                        {badge.description && (
                                                            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{badge.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteBadge(badge.id)}
                                                    className="p-1.5 text-danger bg-danger/5 hover:bg-danger/20 rounded-md transition-colors shrink-0"
                                                    title="Delete Badge"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'bot' && (
                        <div className="max-w-2xl">
                            {selectedBot ? (
                                <form onSubmit={handleSaveBotProfile} className="space-y-6">
                                    <div className="bg-bg-secondary rounded-xl border border-border p-6">
                                        <h3 className="font-bold text-lg mb-4">Bot profile</h3>
                                        <p className="text-sm text-text-muted mb-4">
                                            Customize how <strong className="text-text-primary">{selectedBot.username}</strong> appears (avatar, banner, bio). This user has role &quot;Bot&quot;.
                                        </p>

                                        <div className="flex flex-col sm:flex-row gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Avatar</label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-20 h-20 rounded-full border-2 border-border overflow-hidden bg-bg-tertiary shrink-0">
                                                            {botProfileAvatarPreview ? (
                                                                <img src={botProfileAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Avatar user={selectedBot} size="full" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <input
                                                                ref={botAvatarInputRef}
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={handleBotAvatarSelect}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => botAvatarInputRef.current?.click()}
                                                                className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
                                                            >
                                                                Change avatar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Banner</label>
                                                    <div className="h-24 rounded-lg border-2 border-border overflow-hidden bg-bg-tertiary">
                                                        {botProfileBannerPreview ? (
                                                            <img src={botProfileBannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                                                        ) : selectedBot.banner ? (
                                                            <img src={getRecordFileUrl(selectedBot, selectedBot.banner)} alt="Banner" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">No banner</div>
                                                        )}
                                                    </div>
                                                    <input
                                                        ref={botBannerInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleBotBannerSelect}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => botBannerInputRef.current?.click()}
                                                        className="mt-2 px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
                                                    >
                                                        Change banner
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Display name</label>
                                                    <input
                                                        type="text"
                                                        value={botProfileName}
                                                        onChange={e => setBotProfileName(e.target.value)}
                                                        placeholder="e.g. Union Force"
                                                        className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:border-accent focus:outline-none"
                                                        maxLength={100}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Bio</label>
                                                    <textarea
                                                        value={botProfileBio}
                                                        onChange={e => setBotProfileBio(e.target.value)}
                                                        placeholder="Short description for the bot profile..."
                                                        className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:border-accent focus:outline-none resize-none"
                                                        rows={4}
                                                        maxLength={500}
                                                    />
                                                    <p className="text-right text-xs text-text-muted mt-1">{botProfileBio.length}/500</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                                            <button
                                                type="submit"
                                                disabled={isSavingBotProfile}
                                                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {isSavingBotProfile ? 'Saving...' : 'Save bot profile'}
                                            </button>
                                            <Link
                                                href={`/user/${selectedBot.username}`}
                                                className="text-sm text-text-muted hover:text-accent transition-colors"
                                            >
                                                View profile →
                                            </Link>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <EmptyState
                                    title="No bot user"
                                    description="Assign the “Bot” role to a user (e.g. Union_Force) in the Users tab. Then you can customize their profile here."
                                />
                            )}
                        </div>
                    )}

                    {tab === 'rules' && (
                        <div className="max-w-2xl space-y-6">
                            <div className="bg-bg-secondary rounded-xl border border-border p-6">
                                <h3 className="font-bold text-lg mb-4">Add rule</h3>
                                <form onSubmit={handleAddRule} className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-20">
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Order</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={newRuleOrder}
                                                onChange={e => setNewRuleOrder(parseInt(e.target.value, 10) || 1)}
                                                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:border-accent focus:outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Title</label>
                                            <input
                                                type="text"
                                                value={newRuleTitle}
                                                onChange={e => setNewRuleTitle(e.target.value)}
                                                placeholder="e.g. No spam"
                                                className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:border-accent focus:outline-none"
                                                maxLength={200}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Description (optional)</label>
                                        <textarea
                                            value={newRuleDescription}
                                            onChange={e => setNewRuleDescription(e.target.value)}
                                            placeholder="Short explanation..."
                                            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:border-accent focus:outline-none resize-none"
                                            rows={2}
                                            maxLength={1000}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSavingRule || !newRuleTitle.trim()}
                                        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isSavingRule ? 'Adding...' : 'Add rule'}
                                    </button>
                                </form>
                            </div>
                            <div className="bg-bg-secondary rounded-xl border border-border p-6">
                                <h3 className="font-bold text-lg mb-4">Community rules</h3>
                                <p className="text-sm text-text-muted mb-4">These appear in the sidebar on the main feed. Order by the number (1 = first).</p>
                                {rules.length === 0 ? (
                                    <p className="text-sm text-text-muted">No rules yet. Add one above.</p>
                                ) : (
                                    <ol className="space-y-3">
                                        {rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((rule, i) => (
                                            <li key={rule.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-tertiary">
                                                <span className="text-text-muted font-medium shrink-0">{rule.order ?? i + 1}.</span>
                                                {editingRuleId === rule.id ? (
                                                    <RuleEditForm
                                                        rule={rule}
                                                        onSave={(order, title, description) => handleUpdateRule(rule.id, order, title, description)}
                                                        onCancel={() => setEditingRuleId(null)}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-text-primary">{rule.title}</p>
                                                            {rule.description && <p className="text-xs text-text-muted mt-0.5">{rule.description}</p>}
                                                        </div>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingRuleId(rule.id)}
                                                                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRule(rule.id)}
                                                                className="px-2 py-1 text-xs text-danger hover:bg-danger/10 rounded"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'branding' && (
                        <div className="max-w-2xl space-y-6">
                            <div className="bg-bg-secondary rounded-xl border border-border p-6">
                                <h3 className="font-bold text-lg mb-2">Site branding</h3>
                                <p className="text-sm text-text-muted mb-6">Change the logo and banner shown in the navbar, sidebar, and community card. These appear across the app.</p>
                                <form onSubmit={handleSaveBranding} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Site name</label>
                                        <input
                                            type="text"
                                            value={brandingSiteName}
                                            onChange={e => setBrandingSiteName(e.target.value)}
                                            placeholder="The Union"
                                            className="w-full max-w-md px-4 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
                                            maxLength={100}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Logo</label>
                                        <p className="text-xs text-text-muted mb-2">Shown in the navbar and sidebar (square works best).</p>
                                        <div className="flex items-center gap-4">
                                            {brandingLogoPreview ? (
                                                <img src={brandingLogoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-cover border border-border" />
                                            ) : siteSettingsRecord?.logo ? (
                                                <img src={getRecordFileUrl(siteSettingsRecord as any, siteSettingsRecord.logo)} alt="Current logo" className="w-16 h-16 rounded-lg object-cover border border-border" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center text-text-muted text-xs">No logo</div>
                                            )}
                                            <div>
                                                <input
                                                    ref={brandingLogoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const f = e.target.files?.[0];
                                                        setBrandingLogoFile(f ?? null);
                                                        setBrandingLogoPreview(f ? URL.createObjectURL(f) : null);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => brandingLogoInputRef.current?.click()}
                                                    className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border rounded-lg text-sm text-text-primary transition-colors"
                                                >
                                                    {brandingLogoPreview || siteSettingsRecord?.logo ? 'Change logo' : 'Upload logo'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Banner</label>
                                        <p className="text-xs text-text-muted mb-2">Wide image shown at the top of the sidebar community card.</p>
                                        <div className="space-y-2">
                                            {brandingBannerPreview ? (
                                                <img src={brandingBannerPreview} alt="Banner preview" className="w-full max-w-md h-24 rounded-lg object-cover border border-border" />
                                            ) : siteSettingsRecord?.banner ? (
                                                <img src={getRecordFileUrl(siteSettingsRecord as any, siteSettingsRecord.banner)} alt="Current banner" className="w-full max-w-md h-24 rounded-lg object-cover border border-border" />
                                            ) : (
                                                <div className="w-full max-w-md h-24 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center text-text-muted text-sm">No banner</div>
                                            )}
                                            <input
                                                ref={brandingBannerInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    setBrandingBannerFile(f ?? null);
                                                    setBrandingBannerPreview(f ? URL.createObjectURL(f) : null);
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => brandingBannerInputRef.current?.click()}
                                                className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border rounded-lg text-sm text-text-primary transition-colors"
                                            >
                                                {brandingBannerPreview || siteSettingsRecord?.banner ? 'Change banner' : 'Upload banner'}
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSavingBranding}
                                        className="px-6 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isSavingBranding ? 'Saving...' : 'Save branding'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}

function RuleEditForm({ rule, onSave, onCancel }: { rule: CommunityRule; onSave: (order: number, title: string, description: string) => void; onCancel: () => void }) {
    const [order, setOrder] = useState(rule.order ?? 0);
    const [title, setTitle] = useState(rule.title);
    const [description, setDescription] = useState(rule.description ?? '');
    return (
        <div className="flex-1 space-y-2">
            <div className="flex gap-2">
                <input
                    type="number"
                    min={1}
                    value={order}
                    onChange={e => setOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-14 px-2 py-1 bg-bg-secondary border border-border rounded text-sm"
                />
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="flex-1 px-2 py-1 bg-bg-secondary border border-border rounded text-sm"
                />
            </div>
            <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-2 py-1 bg-bg-secondary border border-border rounded text-sm resize-none"
                rows={2}
            />
            <div className="flex gap-2">
                <button type="button" onClick={() => onSave(order, title, description)} className="px-2 py-1 text-xs bg-accent text-white rounded">Save</button>
                <button type="button" onClick={onCancel} className="px-2 py-1 text-xs text-text-muted hover:bg-bg-hover rounded">Cancel</button>
            </div>
        </div>
    );
}
