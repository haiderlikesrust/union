import { RecordModel } from 'pocketbase';

export interface Badge extends RecordModel {
    name: string;
    image: string;
    description: string;
    tier: number;
    type: 'user' | 'post';
}

// ─── User ─────────────────────────────────────────
export interface User extends RecordModel {
    username: string;
    email: string;
    avatar: string;
    banner: string;
    bio: string;
    karma: number;
    role: 'user' | 'admin' | 'moderator' | 'bot';
    name: string;
    verified: boolean;
    badges: string[];
    /** Base64 ECDH public key for E2E DMs */
    e2ePublicKey?: string;
    expand?: {
        badges?: Badge[];
    };
}

// ─── Post ─────────────────────────────────────────
export type PostType = 'text' | 'image' | 'link';

export interface Post extends RecordModel {
    title: string;
    type: PostType;
    body: string;         // text content or markdown
    image: string;        // uploaded image filename
    url: string;          // link URL
    author: string;       // relation to users
    flair: string;        // post flair/tag
    score: number;
    commentCount: number;
    isPinned: boolean;
    isLocked?: boolean;   // locked threads block new comments/replies for regular users
    isDeleted?: boolean;  // soft delete: show "[deleted post]" instead of removing
    badges: string[];
    // expanded relations
    expand?: {
        author?: User;
        badges?: Badge[];
    };
}

// ─── Comment ──────────────────────────────────────
export interface Comment extends RecordModel {
    content: string;
    post: string;          // relation to posts
    author: string;        // relation to users
    parent: string;        // relation to comments (self-referencing for nesting)
    score: number;
    isPinned?: boolean;
    // expanded relations
    expand?: {
        author?: User;
        parent?: Comment;
        post?: Post;
    };
}

// ─── Post Vote ────────────────────────────────────
export interface PostVote extends RecordModel {
    post: string;
    user: string;
    value: number; // +1 or -1
}

// ─── Comment Vote ─────────────────────────────────
export interface CommentVote extends RecordModel {
    comment: string;
    user: string;
    value: number; // +1 or -1
}

// ─── Saved Post ───────────────────────────────────
export interface SavedPost extends RecordModel {
    post: string;
    user: string;
    expand?: {
        post?: Post;
    };
}

// ─── User Block ───────────────────────────────────
export interface UserBlock extends RecordModel {
    blocker: string;
    blocked: string;
}

// ─── User Follow ──────────────────────────────────
export interface UserFollow extends RecordModel {
    follower: string;
    following: string;
}

// ─── Notification ─────────────────────────────────
export type NotificationType = 'comment' | 'reply' | 'mention' | 'system';

export interface Notification extends RecordModel {
    user: string;           // who receives the notification
    type: NotificationType;
    sourceUser: string;     // who triggered it
    post: string;           // related post
    comment: string;        // related comment
    message: string;        // notification text
    read: boolean;
    expand?: {
        sourceUser?: User;
        post?: Post;
        comment?: Comment;
    };
}

// ─── Report ───────────────────────────────────────
export type ReportReason = 'spam' | 'abuse' | 'harassment' | 'off-topic';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface Report extends RecordModel {
    reporter: string;
    targetType: 'post' | 'comment';
    targetId: string;
    reason: ReportReason;
    details: string;
    status: ReportStatus;
    expand?: {
        reporter?: User;
    };
}

// ─── Ban ──────────────────────────────────────────
export interface Ban extends RecordModel {
    user: string;
    reason: string;
    bannedBy: string;
    expiresAt: string;
    expand?: {
        user?: User;
        bannedBy?: User;
    };
}

// ─── Community Rule ───────────────────────────────
export interface CommunityRule extends RecordModel {
    order: number;
    title: string;
    description: string;
}

// ─── Site settings (branding: logo, banner, name) ───
export interface SiteSettings extends RecordModel {
    siteName?: string;
    logo?: string;
    banner?: string;
}

// ─── Sort types ───────────────────────────────────
export type SortType = 'hot' | 'new' | 'top' | 'rising' | 'controversial';

/** Time range for "Top" and "Controversial" (Reddit-style) */
export type TopTimeFilter = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

/** How to sort comments on a post */
export type CommentSortType = 'best' | 'top' | 'new' | 'controversial' | 'old';

// ─── Knowledge base (community wiki) ─────────────
export type KnowledgeSectionKey = 'best_answers' | 'best_resources' | 'top_comments' | 'community_notes' | 'thread_summary';

export interface KnowledgePage extends RecordModel {
    post: string;
    threadSummary: string;
    expand?: { post?: Post };
}

export interface KnowledgeSection extends RecordModel {
    knowledgePage: string;
    key: KnowledgeSectionKey;
    title: string;
    order: number;
    expand?: { knowledgePage?: KnowledgePage };
}

export interface KnowledgeEntry extends RecordModel {
    section: string;
    content: string;
    linkUrl: string;
    score: number;
    order: number;
    author: string;
    expand?: { section?: KnowledgeSection; author?: User };
}

export interface KnowledgeVote extends RecordModel {
    entry: string;
    user: string;
    value: number;
}

export interface KnowledgeEdit extends RecordModel {
    entry: string;
    editor: string;
    description: string;
    expand?: { editor?: User };
}

// ─── DM (Direct Messages) ─────────────────────────
export interface Conversation extends RecordModel {
    user1: string;
    user2: string;
    expand?: {
        user1?: User;
        user2?: User;
    };
}

export interface DmMessage extends RecordModel {
    conversation: string;
    sender: string;
    text: string;
    /** E2E: encrypted payload (base64). When set, decrypt with shared key; else show text. */
    ciphertext?: string;
    nonce?: string;
    readAt: string | null;
    expand?: {
        conversation?: Conversation;
        sender?: User;
    };
}

export const KNOWLEDGE_SECTION_KEYS: { key: KnowledgeSectionKey; title: string; description: string }[] = [
    { key: 'best_answers', title: 'Best Answers', description: 'Curated answers that best address the question.' },
    { key: 'best_resources', title: 'Best Resources', description: 'Links and references worth saving.' },
    { key: 'top_comments', title: 'Top Comments', description: 'Notable comments from the discussion.' },
    { key: 'community_notes', title: 'Community Notes', description: 'Caveats, corrections, or extra context.' },
    { key: 'thread_summary', title: 'Thread Summary', description: 'High-level summary of the thread (stored at page level).' },
];

// ─── Flair options ────────────────────────────────
// ─── User cloud storage (encrypted, 5GB quota) ───
export const USER_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

export interface UserStorageFile extends RecordModel {
    user: string;
    file: string;       // PocketBase file field (encrypted blob)
    name: string;        // original filename
    size: number;        // original size in bytes (for quota)
    mimeType: string;
    nonce: string;       // base64 nonce for AES-GCM decryption
    expand?: { user?: User };
}

export const FLAIR_OPTIONS = [
    { value: 'discussion', label: 'Discussion', color: '#3B82F6' },
    { value: 'question', label: 'Question', color: '#8B5CF6' },
    { value: 'news', label: 'News', color: '#EF4444' },
    { value: 'meme', label: 'Meme', color: '#F59E0B' },
    { value: 'oc', label: 'Original Content', color: '#10B981' },
    { value: 'meta', label: 'Meta', color: '#6B7280' },
    { value: 'announcement', label: 'Announcement', color: '#EC4899' },
] as const;
