'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { FeedPage } from '@/components/pages/FeedPage';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Show landing if logged out, feed if logged in
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <>
      <Navbar />
      <main className="pt-14 pb-20 md:pb-4">
        <FeedPage />
      </main>
      <MobileNav />
    </>
  );
}

// ─── Landing Page ─────────────────────────────────
function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center font-bold text-sm text-white">
            TU
          </div>
          <span className="text-lg font-bold">The Union</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-full transition-all hover:scale-[1.02]">
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center relative">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-sm text-accent mb-6 border border-accent/20">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            The community is live
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            Where the internet<br />
            <span className="bg-gradient-to-r from-accent via-purple-400 to-pink-400 bg-clip-text text-transparent">
              comes together
            </span>
          </h1>

          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            The Union is one big room — no subreddits, no algorithms, no gatekeeping.
            Just people sharing ideas, arguing about everything, and posting things that matter.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full text-base transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-accent/20"
            >
              Join The Union
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-semibold rounded-full text-base border border-border transition-all hover:border-border-light"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
              title: 'Real Conversations',
              desc: 'Post text, images, or links. Start threads. Reply to everything. No character limits on thinking.',
            },
            {
              icon: (
                <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              title: 'Community-Driven',
              desc: 'Upvote what matters. Downvote what doesn\'t. The best stuff rises, naturally.',
            },
            {
              icon: (
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
              title: 'One Community',
              desc: 'No fragmentation. Everyone shares the same space. The Union is one conversation.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-bg-secondary rounded-2xl border border-border hover:border-border-light transition-all group"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-text-muted">
        The Union © {new Date().getFullYear()} — Built for the internet
      </footer>
    </div>
  );
}
