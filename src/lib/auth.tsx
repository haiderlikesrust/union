'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import PocketBase, { RecordModel } from 'pocketbase';
import { createBrowserClient } from './pocketbase';
import { User } from './types';

interface AuthContextType {
    pb: PocketBase;
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string, passwordConfirm: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: FormData) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const pb = createBrowserClient();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Sync auth state from PocketBase
    const syncUser = useCallback(() => {
        if (pb.authStore.isValid && pb.authStore.record) {
            setUser(pb.authStore.record as unknown as User);
        } else {
            setUser(null);
        }
    }, [pb]);

    useEffect(() => {
        syncUser();
        setIsLoading(false);

        // Listen for auth state changes
        const unsub = pb.authStore.onChange(() => {
            syncUser();
        });

        return () => { unsub(); };
    }, [pb, syncUser]);

    const login = async (email: string, password: string) => {
        await pb.collection('users').authWithPassword(email, password);
        syncUser();
    };

    const signup = async (username: string, email: string, password: string, passwordConfirm: string) => {
        // Create the user
        await pb.collection('users').create({
            username,
            email,
            password,
            passwordConfirm,
            name: username,
            role: 'user',
            karma: 0,
            bio: '',
        });
        // Then log them in
        await pb.collection('users').authWithPassword(email, password);
        syncUser();
    };

    const logout = () => {
        pb.authStore.clear();
        setUser(null);
    };

    const updateProfile = async (data: FormData) => {
        if (!user) return;
        const record = await pb.collection('users').update(user.id, data);
        setUser(record as unknown as User);
    };

    const refreshUser = async () => {
        if (!pb.authStore.isValid) return;
        try {
            const record = await pb.collection('users').authRefresh();
            setUser(record.record as unknown as User);
        } catch {
            pb.authStore.clear();
            setUser(null);
        }
    };

    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{ pb, user, isLoading, isAdmin, login, signup, logout, updateProfile, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
