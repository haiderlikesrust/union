'use client';

import { AuthProvider } from '@/lib/auth';
import { SiteSettingsProvider } from '@/lib/site-settings';
import { ThemeProvider } from '@/lib/theme';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ThemeProvider>
            <SiteSettingsProvider>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#1e1e22',
                        color: '#fafafa',
                        border: '1px solid #2a2a2e',
                        borderRadius: '12px',
                        fontSize: '14px',
                    },
                    success: {
                        iconTheme: { primary: '#22c55e', secondary: '#fafafa' },
                    },
                    error: {
                        iconTheme: { primary: '#ef4444', secondary: '#fafafa' },
                    },
                }}
            />
            {children}
            </SiteSettingsProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}
