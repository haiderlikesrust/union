# The Union

**Where the internet comes together.** A single-community Reddit-style platform built with Next.js and PocketBase.

![The Union](https://img.shields.io/badge/The_Union-Community-6366f1?style=for-the-badge)

## Features

- **Authentication** — Sign up, log in, avatar upload, profile editing
- **Posts** — Create text, image, or link posts with flair tags
- **Comments** — Nested comment threads with reply support
- **Voting** — Upvote/downvote on posts and comments with score sync
- **Feed** — Sort by Hot, New, or Top with pagination
- **Profiles** — User profiles with karma, bio, post/comment history
- **Search** — Search posts by title/content, users by username
- **Saved Posts** — Save and access posts later
- **Notifications** — Get notified on comments, replies, and mentions
- **Admin Panel** — Manage users, posts, reports, bans, and pin posts
- **Markdown** — Markdown support in text posts and comments
- **Dark Theme** — Beautiful dark-mode-first design
- **Responsive** — Works on desktop and mobile with bottom nav

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, App Router |
| Styling | Tailwind CSS v4 |
| Backend | PocketBase |
| Auth | PocketBase Auth |
| Database | PocketBase (SQLite) |
| File Storage | PocketBase Files |

## Quick Start

### Prerequisites

- **Node.js** 18+ 
- **PocketBase** — Download from [pocketbase.io](https://pocketbase.io/docs/)

### 1. Setup PocketBase

Download PocketBase and place the executable in the project root (or anywhere):

```bash
# Example: download and extract to project root
# Then start PocketBase
./pocketbase serve
```

On first start, PocketBase will:
- Create the admin dashboard at `http://127.0.0.1:8090/_/`
- Auto-apply migrations from `pb_migrations/` to create all collections
- Load hooks from `pb_hooks/` for vote sync, notifications, etc.

**Create an admin account** at `http://127.0.0.1:8090/_/` on first visit.

### 2. Setup Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see The Union landing page.

### 3. Create Your First User

1. Click **Sign up** on the landing page
2. Create a user with username, email, and password
3. To make this user an admin, go to PocketBase dashboard → `users` collection → edit the user → set `role` to `admin`

## Environment Variables

```env
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

## Project Structure

```
the-union/
├── pb_migrations/           # PocketBase schema migrations
├── pb_hooks/                # PocketBase server-side hooks
│   └── main.pb.js           # Vote sync, karma, notifications
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Landing / Feed
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── create/          # Create post
│   │   ├── post/[id]/       # Single post + edit
│   │   ├── user/[username]/ # User profile
│   │   ├── saved/           # Saved posts
│   │   ├── search/          # Search
│   │   ├── notifications/   # Notifications
│   │   └── admin/           # Admin dashboard
│   ├── components/
│   │   ├── layout/          # Navbar, Sidebar, MobileNav
│   │   ├── posts/           # PostCard, VoteButtons
│   │   ├── comments/        # CommentThread, CommentItem, CommentForm
│   │   ├── pages/           # FeedPage
│   │   └── ui/              # Avatar, Button, Modal, Skeleton, etc.
│   ├── hooks/               # useVote
│   └── lib/                 # pocketbase, auth, types, utils
├── .env.local
└── package.json
```

## PocketBase Collections

| Collection | Purpose |
|-----------|---------|
| `users` | Auth collection with bio, karma, role |
| `posts` | Text, image, and link posts |
| `comments` | Nested comments on posts |
| `post_votes` | Post upvotes/downvotes |
| `comment_votes` | Comment upvotes/downvotes |
| `saved_posts` | User's saved posts |
| `notifications` | User notifications |
| `reports` | Content reports |
| `bans` | User bans/suspensions |

## Server-Side Hooks

The `pb_hooks/main.pb.js` file handles:

- **Vote deduplication** — Prevents duplicate votes, toggles/switches existing votes
- **Score sync** — Recalculates post/comment scores after vote changes
- **Comment count** — Updates post comment count on create/delete
- **Karma sync** — Updates user karma based on total post + comment scores
- **Notifications** — Creates notifications when someone comments or replies

---

Built for the internet. By the internet.
