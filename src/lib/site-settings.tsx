'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createBrowserClient } from '@/lib/pocketbase';
import { getRecordFileUrl } from '@/lib/pocketbase';
import type { SiteSettings } from '@/lib/types';

interface SiteSettingsState {
    siteName: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    record: SiteSettings | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const defaultSiteName = 'The Union';

const SiteSettingsContext = createContext<SiteSettingsState>({
    siteName: defaultSiteName,
    logoUrl: null,
    bannerUrl: null,
    record: null,
    loading: true,
    refresh: async () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
    const [record, setRecord] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const pb = createBrowserClient();
            const res = await pb.collection('site_settings').getList(1, 1);
            const item = res.items[0] as unknown as SiteSettings | undefined;
            setRecord(item ?? null);
        } catch {
            setRecord(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const siteName = (record?.siteName?.trim() || defaultSiteName);
    const logoUrl = record?.logo && record?.id
        ? getRecordFileUrl(record as any, record.logo)
        : null;
    const bannerUrl = record?.banner && record?.id
        ? getRecordFileUrl(record as any, record.banner)
        : null;

    return (
        <SiteSettingsContext.Provider
            value={{
                siteName,
                logoUrl,
                bannerUrl,
                record,
                loading,
                refresh: load,
            }}
        >
            {children}
        </SiteSettingsContext.Provider>
    );
}

export function useSiteSettings() {
    return useContext(SiteSettingsContext);
}
