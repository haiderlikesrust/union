'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'the-union-theme';

export type ThemeId = 'default' | 'spongebob' | 'minecraft' | 'cod' | 'reddit';

type Theme = {
    id: ThemeId;
    name: string;
    description: string;
};

export const THEMES: Theme[] = [
    { id: 'default', name: 'Union', description: 'Warm dark + teal — our signature look' },
    { id: 'reddit', name: 'Reddit', description: 'Classic subreddit look' },
    { id: 'spongebob', name: 'SpongeBob', description: 'Bikini Bottom vibes' },
    { id: 'minecraft', name: 'Minecraft', description: 'Blocky & pixel vibes' },
    { id: 'cod', name: 'Call of Duty', description: 'Tactical military style' },
];

type ThemeContextValue = {
    theme: ThemeId;
    setTheme: (id: ThemeId) => void;
    changeThemeWithAnimation: (id: ThemeId) => void;
    themes: Theme[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID_THEMES: ThemeId[] = ['default', 'spongebob', 'minecraft', 'cod', 'reddit'];

function readStoredTheme(): ThemeId {
    if (typeof window === 'undefined') return 'default';
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_THEMES.includes(stored as ThemeId)) return stored as ThemeId;
    } catch {}
    return 'default';
}

function applyTheme(id: ThemeId) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', id);
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>('default');
    const [transitionToTheme, setTransitionToTheme] = useState<ThemeId | null>(null);

    useEffect(() => {
        const stored = readStoredTheme();
        setThemeState(stored);
        applyTheme(stored);
    }, []);

    const setTheme = useCallback((id: ThemeId) => {
        setThemeState(id);
        applyTheme(id);
    }, []);

    const changeThemeWithAnimation = useCallback((id: ThemeId) => {
        if (id === theme) return;
        setTransitionToTheme(id);
        const delays: Record<ThemeId, { switch: number; clear: number }> = {
            default: { switch: 350, clear: 1100 },
            reddit: { switch: 400, clear: 1100 },
            spongebob: { switch: 600, clear: 1200 },
            minecraft: { switch: 900, clear: 2100 },
            cod: { switch: 400, clear: 1100 },
        };
        const { switch: switchDelay, clear: clearDelay } = delays[id];
        const t = setTimeout(() => {
            setThemeState(id);
            applyTheme(id);
        }, switchDelay);
        const t2 = setTimeout(() => setTransitionToTheme(null), clearDelay);
        return () => { clearTimeout(t); clearTimeout(t2); };
    }, [theme]);

    return (
        <ThemeContext.Provider
            value={{
                theme,
                setTheme,
                changeThemeWithAnimation,
                themes: THEMES,
            }}
        >
            {children}
            {transitionToTheme && (
                <ThemeTransitionOverlay nextTheme={transitionToTheme} />
            )}
        </ThemeContext.Provider>
    );
}

const BUBBLE_COUNT = 28;
const bubblePositions = Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
    left: 2 + (i * 3.5) % 92,
    size: 28 + (i % 4) * 18,
    delay: (i % 6) * 0.07,
}));

/** Minecraft grass block side texture — 16x16 pixel art (grass top, jagged edge, dirt with stone) */
function MinecraftGrassBlockSVG({ size = 64 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            style={{ imageRendering: 'pixelated', display: 'block' }}
        >
            {/* Row 0–1: grass top */}
            <rect x="0" y="0" width="16" height="2" fill="#8BC34A" />
            {/* Row 2: grass */}
            <rect x="0" y="2" width="16" height="1" fill="#7CB342" />
            {/* Row 3: grass with variation — jagged start */}
            <rect x="0" y="3" width="2" height="1" fill="#8BC34A" />
            <rect x="2" y="3" width="4" height="1" fill="#5D9E2E" />
            <rect x="6" y="3" width="2" height="1" fill="#7CB342" />
            <rect x="8" y="3" width="4" height="1" fill="#5D9E2E" />
            <rect x="12" y="3" width="4" height="1" fill="#7CB342" />
            {/* Row 4: jagged grass–dirt boundary */}
            <rect x="0" y="4" width="2" height="1" fill="#5D9E2E" />
            <rect x="2" y="4" width="2" height="1" fill="#7CB342" />
            <rect x="4" y="4" width="4" height="1" fill="#5D9E2E" />
            <rect x="8" y="4" width="2" height="1" fill="#8BC34A" />
            <rect x="10" y="4" width="4" height="1" fill="#5D9E2E" />
            <rect x="14" y="4" width="2" height="1" fill="#7CB342" />
            {/* Dirt base (y 5–15) */}
            <rect x="0" y="5" width="16" height="11" fill="#8B7355" />
            {/* Dirt variation — darker/lighter brown */}
            <rect x="1" y="5" width="1" height="1" fill="#6B5344" />
            <rect x="5" y="5" width="2" height="1" fill="#5A4A3A" />
            <rect x="10" y="5" width="1" height="1" fill="#6B5344" />
            <rect x="14" y="6" width="1" height="1" fill="#4A3A2A" />
            <rect x="3" y="7" width="1" height="1" fill="#6B6B6B" />
            <rect x="8" y="7" width="2" height="1" fill="#5A4A3A" />
            <rect x="12" y="7" width="1" height="1" fill="#6B5344" />
            <rect x="0" y="8" width="2" height="1" fill="#4A3A2A" />
            <rect x="6" y="9" width="1" height="1" fill="#6B6B6B" />
            <rect x="11" y="9" width="1" height="1" fill="#5A5A5A" />
            <rect x="2" y="10" width="1" height="1" fill="#6B5344" />
            <rect x="9" y="11" width="2" height="1" fill="#4A3A2A" />
            <rect x="4" y="12" width="1" height="1" fill="#6B6B6B" />
            <rect x="13" y="13" width="1" height="1" fill="#5A4A3A" />
            <rect x="7" y="14" width="1" height="1" fill="#6B5344" />
        </svg>
    );
}

const OVERLAY_CLEAR: Record<ThemeId, number> = {
    default: 1100,
    reddit: 1100,
    spongebob: 1200,
    minecraft: 2100,
    cod: 1100,
};

function ThemeTransitionOverlay({ nextTheme }: { nextTheme: ThemeId }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const ms = OVERLAY_CLEAR[nextTheme];
        const t = setTimeout(() => setVisible(false), ms);
        return () => clearTimeout(t);
    }, [nextTheme]);

    if (!visible) return null;

    const overlayClass =
        nextTheme === 'reddit' ? 'theme-transition-reddit' :
        nextTheme === 'spongebob' ? 'theme-transition-spongebob' :
        nextTheme === 'minecraft' ? 'theme-transition-minecraft' :
        nextTheme === 'cod' ? 'theme-transition-cod' :
        'theme-transition-default';

    return (
        <div
            className="fixed inset-0 z-[9999] pointer-events-none"
            aria-hidden
        >
            <div className={`theme-transition-overlay ${overlayClass}`}>
                {nextTheme === 'spongebob' && bubblePositions.map((b, i) => (
                    <div
                        key={i}
                        className="theme-bubble"
                        style={{
                            left: `${b.left}%`,
                            bottom: '-5%',
                            width: b.size,
                            height: b.size,
                            animationDelay: `${b.delay}s`,
                        }}
                    />
                ))}
                {nextTheme === 'minecraft' && <div className="theme-minecraft-tiled" aria-hidden />}
            </div>
        </div>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
