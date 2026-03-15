'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useFollowList } from '@/hooks/useFollowList';
import { useBlockList } from '@/hooks/useBlockList';
import { getRecordFileUrl } from '@/lib/pocketbase';
import { User, Post, Comment } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNumber, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function UserProfilePage() {
    const { username } = useParams<{ username: string }>();
    const { pb, user: currentUser } = useAuth();
    const { isFollowing, followUser, unfollowUser } = useFollowList();
    const { isBlocked, blockUser, unblockUser } = useBlockList();
    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [tab, setTab] = useState<'overview' | 'posts' | 'comments'>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Edit state
    const [bio, setBio] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    const isOwnProfile = currentUser?.username === username;
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                // Find user by username
                const users = await pb.collection('users').getList(1, 1, {
                    filter: `username = "${username}"`,
                    expand: 'badges'
                });

                if (users.items.length === 0) {
                    setIsLoading(false);
                    return;
                }
                const u = users.items[0] as unknown as User;
                setProfileUser(u);
                setBio(u.bio || '');

                // Fetch user's posts
                const userPosts = await pb.collection('posts').getList(1, 20, {
                    filter: `author = "${u.id}"`,
                    sort: '-created',
                    expand: 'author,author.badges,badges',
                });
                setPosts(userPosts.items as unknown as Post[]);

                // Fetch user's comments
                const userComments = await pb.collection('comments').getList(1, 50, {
                    filter: `author = "${u.id}"`,
                    sort: '-created',
                    expand: 'author,author.badges,post',
                });
                setComments(userComments.items as unknown as Comment[]);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [pb, username]);

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async () => {
        if (!currentUser || !profileUser) return;
        try {
            const formData = new FormData();
            formData.append('bio', bio);
            if (avatarFile) formData.append('avatar', avatarFile);
            if (bannerFile) formData.append('banner', bannerFile);

            await pb.collection('users').update(profileUser.id, formData);
            toast.success('Profile updated');
            setIsEditing(false);

            // Refresh profile
            const updated = await pb.collection('users').getOne(profileUser.id, { expand: 'badges' });
            setProfileUser(updated as unknown as User);

            // Clear previews and files
            setAvatarPreview(null);
            setBannerPreview(null);
            setAvatarFile(null);
            setBannerFile(null);

        } catch {
            toast.error('Failed to update profile');
        }
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setBio(profileUser?.bio || '');
        setAvatarPreview(null);
        setBannerPreview(null);
        setAvatarFile(null);
        setBannerFile(null);
    };

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="pt-14">
                    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                        <Skeleton className="w-full h-48 rounded-2xl" />
                        <div className="flex items-end gap-6 px-6 -mt-12">
                            <Skeleton className="w-24 h-24 rounded-full border-4 border-bg-primary" />
                            <div className="flex-1 space-y-2 mb-2">
                                <Skeleton className="w-48 h-8" />
                                <Skeleton className="w-32 h-4" />
                            </div>
                        </div>
                        <Skeleton className="w-full h-32 mt-8 rounded-2xl" />
                    </div>
                </main>
            </>
        );
    }

    if (!profileUser) {
        return (
            <>
                <Navbar />
                <main className="pt-14">
                    <EmptyState title="User not found" description="This user doesn't exist or has been removed." />
                </main>
            </>
        );
    }

    const currentBannerUrl = bannerPreview || (profileUser.banner ? getRecordFileUrl(profileUser, profileUser.banner) : null);

    // We create a temporary user object with the right avatar string just for the Avatar component preview
    const previewUser = avatarPreview ? { ...profileUser, avatar: '' } : profileUser; // the Avatar component knows how to handle raw string versus PB image? Wait. Avatar takes user object. We should probably pass the preview as a separate prop or just use an img. It's easier just to pass a fake avatar string but getImageUrl expects a pocketbase object. 

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4 min-h-screen">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    {/* Profile Header Container */}
                    <div className="bg-bg-secondary rounded-2xl border border-border overflow-hidden mb-6 relative group">

                        {/* Banner */}
                        <div className="relative h-32 sm:h-48 bg-gradient-to-r from-accent/30 via-purple-600/30 to-pink-600/30 group">
                            {currentBannerUrl && (
                                <img src={currentBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                            )}

                            {isEditing && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => bannerInputRef.current?.click()}
                                        className="px-4 py-2 bg-black/60 text-white rounded-full flex items-center gap-2 hover:bg-black/80 transition-colors backdrop-blur-sm"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        Change Banner
                                    </button>
                                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerSelect} />
                                </div>
                            )}
                        </div>

                        {/* Profile Info overlay */}
                        <div className="px-6 pb-6 relative">
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-16 sm:mb-2">
                                {/* Avatar wrapper */}
                                <div className="relative inline-block group/avatar shrink-0 z-10">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-bg-secondary bg-bg-secondary overflow-hidden shrink-0">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Avatar user={profileUser} size="full" />
                                        )}
                                    </div>

                                    {isEditing && (
                                        <div
                                            onClick={() => avatarInputRef.current?.click()}
                                            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer border-4 border-transparent"
                                        >
                                            <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                                        </div>
                                    )}
                                </div>

                                {/* Username and Meta */}
                                <div className="flex-1 mt-2 sm:mt-0 relative z-10">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{profileUser.username}</h1>
                                        {profileUser.expand?.badges?.map(badge => (
                                            <img
                                                key={badge.id}
                                                src={getRecordFileUrl(badge, badge.image)}
                                                alt={badge.name}
                                                title={badge.name}
                                                className="w-5 h-5 sm:w-6 sm:h-6 object-cover rounded-sm drop-shadow-sm"
                                            />
                                        ))}
                                        {profileUser.role === 'bot' && (
                                            <span className="px-2 py-0.5 bg-[#5865F2]/20 text-[#5865F2] text-xs font-bold rounded-full uppercase tracking-wider border border-[#5865F2]/40">
                                                Bot
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                                        <span className="flex items-center gap-1.5 bg-bg-tertiary px-2 py-0.5 rounded-full border border-border">
                                            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                            <span className="font-medium text-text-primary">{formatNumber(profileUser.karma || 0)}</span> karma
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Joined {timeAgo(profileUser.created)}
                                        </span>
                                        {profileUser.role === 'admin' && (
                                            <span className="px-2 py-0.5 bg-danger/10 text-danger text-xs rounded-full font-bold uppercase tracking-wider">Admin</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {!isOwnProfile && currentUser && profileUser && (
                                    <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0 shrink-0">
                                        {isBlocked(profileUser.id) ? (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await unblockUser(profileUser.id);
                                                        toast.success('User unblocked');
                                                    } catch { toast.error('Failed to unblock'); }
                                                }}
                                                className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg border border-border transition-colors"
                                            >
                                                Unblock
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            if (isFollowing(profileUser.id)) {
                                                                await unfollowUser(profileUser.id);
                                                                toast.success('Unfollowed');
                                                            } else {
                                                                await followUser(profileUser.id);
                                                                toast.success('Following');
                                                            }
                                                        } catch { toast.error('Something went wrong'); }
                                                    }}
                                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${isFollowing(profileUser.id) ? 'bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border' : 'bg-accent hover:bg-accent-hover text-white'}`}
                                                >
                                                    {isFollowing(profileUser.id) ? 'Unfollow' : 'Follow'}
                                                </button>
                                                <Link
                                                    href={`/messages/new?with=${encodeURIComponent(profileUser.username)}`}
                                                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                    Message
                                                </Link>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Block this user? You won\'t see their posts or comments.')) return;
                                                        try {
                                                            await blockUser(profileUser.id);
                                                            toast.success('User blocked');
                                                        } catch { toast.error('Failed to block'); }
                                                    }}
                                                    className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    Block
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                                {isOwnProfile && (
                                    <div className="flex items-center gap-2 mt-4 sm:mt-0 shrink-0">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg border border-border transition-colors w-full sm:w-auto"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleUpdateProfile}
                                                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
                                                >
                                                    Save Changes
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg border border-border transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Edit Profile
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bio Area */}
                            <div className="mt-6 md:mt-4 md:pl-[144px]"> {/* Align with username (avatar is 128px + 16px gap) */}
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">About You</label>
                                        <textarea
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            placeholder="Write a brief bio..."
                                            className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none min-h-[100px]"
                                            maxLength={500}
                                        />
                                        <p className="text-right text-xs text-text-muted">{bio.length}/500</p>
                                    </div>
                                ) : (
                                    profileUser.bio && (
                                        <div className="bg-bg-tertiary/50 rounded-xl p-4 border border-border/50">
                                            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{profileUser.bio}</p>
                                        </div>
                                    )
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Tabs — Reddit-style: Overview, Posts, Comments */}
                    <div className="flex border-b border-border mb-6 overflow-x-auto">
                        {(['overview', 'posts', 'comments'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-5 py-4 text-sm font-bold border-b-2 transition-all capitalize whitespace-nowrap ${tab === t
                                    ? 'border-accent text-accent'
                                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
                                    }`}
                            >
                                {t === 'overview' ? 'Overview' : t === 'posts' ? `Posts (${posts.length})` : `Comments (${comments.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    {tab === 'overview' && (() => {
                        type ActivityItem = { type: 'post'; date: string; post: Post } | { type: 'comment'; date: string; comment: Comment };
                        const activities: ActivityItem[] = [
                            ...posts.map((post): ActivityItem => ({ type: 'post', date: post.created, post })),
                            ...comments.map((c): ActivityItem => ({ type: 'comment', date: c.created, comment: c })),
                        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        if (activities.length === 0) {
                            return (
                                <EmptyState
                                    title="No activity yet"
                                    description={`${profileUser.username} hasn't posted or commented yet.`}
                                />
                            );
                        }
                        return (
                            <div className="space-y-0 divide-y divide-border">
                                {activities.map((item) =>
                                    item.type === 'post' ? (
                                        <div key={`post-${item.post.id}`} className="py-3 first:pt-0">
                                            <PostCard
                                                post={item.post}
                                                onDelete={() => setPosts(prev => prev.filter(p => p.id !== item.post.id))}
                                            />
                                        </div>
                                    ) : (
                                        <Link
                                            key={`comment-${item.comment.id}`}
                                            href={`/post/${item.comment.post}`}
                                            className="flex gap-3 py-4 px-2 -mx-2 rounded-lg hover:bg-bg-hover/50 transition-colors"
                                        >
                                            <div className="shrink-0 w-8 flex flex-col items-center pt-0.5">
                                                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                </svg>
                                                <span className="text-xs font-semibold text-text-muted mt-0.5">{formatNumber(item.comment.score ?? 0)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-text-muted mb-1">
                                                    Commented on <span className="text-accent font-medium hover:underline">{(item.comment.expand?.post as Post)?.title ?? 'a post'}</span>
                                                    <span className="mx-1.5">·</span>
                                                    {timeAgo(item.comment.created)}
                                                </p>
                                                <p className="text-sm text-text-primary line-clamp-2">{item.comment.content}</p>
                                            </div>
                                        </Link>
                                    )
                                )}
                            </div>
                        );
                    })()}

                    {tab === 'posts' && (
                        <div className="space-y-0 divide-y divide-border">
                            {posts.length > 0 ? (
                                posts.map(post => (
                                    <div key={post.id} className="py-3 first:pt-0">
                                        <PostCard post={post} onDelete={() => setPosts(prev => prev.filter(p => p.id !== post.id))} />
                                    </div>
                                ))
                            ) : (
                                <EmptyState title="No posts yet" description={`${profileUser.username} hasn't posted anything yet.`} />
                            )}
                        </div>
                    )}

                    {tab === 'comments' && (
                        <div className="space-y-0 divide-y divide-border">
                            {comments.length > 0 ? (
                                comments.map(c => (
                                    <Link
                                        key={c.id}
                                        href={`/post/${c.post}`}
                                        className="flex gap-3 py-4 px-2 -mx-2 rounded-lg hover:bg-bg-hover/50 transition-colors"
                                    >
                                        <div className="shrink-0 w-8 flex flex-col items-center pt-0.5">
                                            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <span className="text-xs font-semibold text-text-muted mt-0.5">{formatNumber(c.score ?? 0)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-text-muted mb-1">
                                                {(c.expand?.post as Post)?.title && (
                                                    <>
                                                        <span className="text-accent font-medium">{(c.expand?.post as Post)?.title}</span>
                                                        <span className="mx-1.5">·</span>
                                                    </>
                                                )}
                                                {timeAgo(c.created)}
                                            </p>
                                            <p className="text-sm text-text-primary leading-relaxed line-clamp-3">{c.content}</p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <EmptyState title="No comments yet" description={`${profileUser.username} hasn't commented yet.`} />
                            )}
                        </div>
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
