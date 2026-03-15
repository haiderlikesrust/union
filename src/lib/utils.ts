import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Returns a relative timestamp like "2h ago", "3d ago"
 */
export function timeAgo(dateString: string): string {
    try {
        const date = new Date(dateString);
        return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch {
        return 'just now';
    }
}

/**
 * Calculates a "hot" score based on Reddit's hot ranking algorithm.
 * Combines score (votes) with recency.
 */
export function hotScore(score: number, createdAt: string): number {
    const order = Math.log10(Math.max(Math.abs(score), 1));
    const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
    const created = new Date(createdAt).getTime() / 1000;
    const epoch = new Date('2024-01-01').getTime() / 1000;
    const seconds = created - epoch;
    return sign * order + seconds / 45000;
}

/**
 * Formats large numbers compactly (1.2k, 3.4M, etc.)
 */
export function formatNumber(num: number): string {
    if (Math.abs(num) >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (Math.abs(num) >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}

/**
 * Validates a URL string
 */
export function isValidUrl(str: string): boolean {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Extracts domain from a URL for display
 */
export function extractDomain(url: string): string {
    try {
        const u = new URL(url);
        return u.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Truncates text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
}

/**
 * Generates initials from a username for avatar fallbacks
 */
export function getInitials(username: string): string {
    if (!username) return '?';
    return username.slice(0, 2).toUpperCase();
}

/**
 * Returns the PocketBase sort string for each sort type
 */
export function getSortString(sort: string): string {
    switch (sort) {
        case 'new':
            return '-created';
        case 'top':
            return '-score,-created';
        case 'rising':
            // Newer posts with engagement (score then recency)
            return '-score,-created';
        case 'controversial':
            // Posts with score closest to 0 first (ascending score, then newest)
            return 'score,-created';
        case 'hot':
        default:
            return '-isPinned,-score,-created';
    }
}

/**
 * Returns ISO date string for "Top" / "Controversial" time filter (for PocketBase filter).
 * Use with filter: created >= " returned value "
 */
export function getTopTimeFilterDate(filter: string): string | null {
    const now = new Date();
    switch (filter) {
        case 'hour': {
            const d = new Date(now);
            d.setHours(d.getHours() - 1);
            return d.toISOString();
        }
        case 'day': {
            const d = new Date(now);
            d.setDate(d.getDate() - 1);
            return d.toISOString();
        }
        case 'week': {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            return d.toISOString();
        }
        case 'month': {
            const d = new Date(now);
            d.setMonth(d.getMonth() - 1);
            return d.toISOString();
        }
        case 'year': {
            const d = new Date(now);
            d.setFullYear(d.getFullYear() - 1);
            return d.toISOString();
        }
        case 'all':
        default:
            return null;
    }
}

/**
 * Strips HTML tags from a string
 */
export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
}

/**
 * Generates a color from a string (for consistent avatar colors)
 */
export function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${Math.abs(hue)}, 65%, 45%)`;
}
