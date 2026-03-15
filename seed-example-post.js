/**
 * Seed an example post with comments and a Knowledge page so you can see the feature in action.
 *
 * Run (same as setup – use your PocketBase admin account):
 *   node seed-example-post.js <admin-email> <admin-password>
 * or: npm run seed -- admin@theunion.com yourpassword
 *
 * Then open the app, go to the feed, and open the new post. Use the "Knowledge" tab.
 */

require('dotenv').config({ path: '.env.local' });
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

async function main() {
    const [, , email, password] = process.argv;
    if (!email || !password) {
        console.error('Usage: node seed-example-post.js <admin-email> <admin-password>');
        process.exit(1);
    }

    console.log('\n🌱 Seeding example post with Knowledge page...\n');

    // Admin auth
    let token;
    const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
    });
    if (!authRes.ok) {
        const alt = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password }),
        });
        if (!alt.ok) {
            console.error('❌ Admin login failed. Use the same email/password as setup-pb.js');
            process.exit(1);
        }
        token = (await alt.json()).token;
    } else {
        token = (await authRes.json()).token;
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': token };

    // Get first user as author
    const usersRes = await fetch(`${PB_URL}/api/collections/users/records?perPage=1`, { headers });
    if (!usersRes.ok) {
        console.error('❌ Could not fetch users. Run the app and sign up at least one user.');
        process.exit(1);
    }
    const usersData = await usersRes.json();
    const authorId = usersData.items?.[0]?.id;
    if (!authorId) {
        console.error('❌ No users found. Sign up at least one user in the app first.');
        process.exit(1);
    }
    console.log('✅ Using author:', usersData.items[0].username || authorId);

    // Create example post
    const postPayload = {
        title: 'What’s the best way to understand Rust ownership and the borrow checker?',
        type: 'text',
        body: `I’m learning Rust and keep hitting borrow checker errors. What helped you really “get” ownership and borrowing?

- Any **resources** (articles, videos, books) that clicked for you?
- How do you think about ownership when designing functions?
- Tips for debugging borrow errors?`,
        author: authorId,
        score: 5,
        commentCount: 0,
        isPinned: false,
    };

    const postRes = await fetch(`${PB_URL}/api/collections/posts/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify(postPayload),
    });
    if (!postRes.ok) {
        const err = await postRes.json();
        console.error('❌ Failed to create post:', JSON.stringify(err, null, 2));
        process.exit(1);
    }
    const post = await postRes.json();
    console.log('✅ Created post:', post.id);

    // Create a few comments
    const comments = [
        { content: 'The Rust Book chapter on ownership is the best place to start. Then try writing a small CLI tool and refactoring it to avoid clones.', post: post.id, author: authorId, parent: '', score: 3 },
        { content: 'Think of ownership as “who can drop this value.” Only one owner at a time. References are “borrows” that must end before the owner is dropped.', post: post.id, author: authorId, parent: '', score: 2 },
    ];
    for (const c of comments) {
        const cr = await fetch(`${PB_URL}/api/collections/comments/records`, { method: 'POST', headers, body: JSON.stringify(c) });
        if (cr.ok) console.log('  Comment added');
    }

    // Update post comment count
    await fetch(`${PB_URL}/api/collections/posts/records/${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ commentCount: comments.length }),
    });

    // Create Knowledge page
    const pageRes = await fetch(`${PB_URL}/api/collections/knowledge_pages/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            post: post.id,
            threadSummary: 'A short discussion on understanding Rust ownership and the borrow checker, with recommended resources and mental models.',
        }),
    });
    if (!pageRes.ok) {
        console.error('❌ Failed to create knowledge page. Did you run setup-pb.js?', await pageRes.text());
        process.exit(1);
    }
    const knowledgePage = await pageRes.json();
    console.log('✅ Created Knowledge page');

    // Create 5 sections
    const sectionKeys = [
        { key: 'best_answers', title: 'Best Answers' },
        { key: 'best_resources', title: 'Best Resources' },
        { key: 'top_comments', title: 'Top Comments' },
        { key: 'community_notes', title: 'Community Notes' },
        { key: 'thread_summary', title: 'Thread Summary' },
    ];
    const sectionIds = [];
    for (let i = 0; i < sectionKeys.length; i++) {
        const sr = await fetch(`${PB_URL}/api/collections/knowledge_sections/records`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                knowledgePage: knowledgePage.id,
                key: sectionKeys[i].key,
                title: sectionKeys[i].title,
                order: i,
            }),
        });
        if (sr.ok) sectionIds.push((await sr.json()).id);
    }
    console.log('✅ Created 5 Knowledge sections');

    // Add example entries to Best Answers and Best Resources
    const bestAnswersSectionId = sectionIds[0];
    const bestResourcesSectionId = sectionIds[1];

    const entries = [
        { section: bestAnswersSectionId, content: 'Start with **The Rust Book** chapter on ownership. Then practice by writing a small project and refactoring to avoid unnecessary clones.', linkUrl: '', score: 4, order: 0, author: authorId },
        { section: bestAnswersSectionId, content: 'Mental model: ownership = “who can drop this.” Only one owner; references are borrows that must end before the owner is dropped.', linkUrl: '', score: 3, order: 1, author: authorId },
        { section: bestResourcesSectionId, content: 'The official Rust Book – Ownership chapter', linkUrl: 'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html', score: 5, order: 0, author: authorId },
        { section: bestResourcesSectionId, content: 'Rust by Example – Ownership and moves', linkUrl: 'https://doc.rust-lang.org/rust-by-example/scope/move.html', score: 2, order: 1, author: authorId },
    ];

    for (const e of entries) {
        await fetch(`${PB_URL}/api/collections/knowledge_entries/records`, {
            method: 'POST',
            headers,
            body: JSON.stringify(e),
        });
    }
    console.log('✅ Added example Knowledge entries');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('\n🎉 Done! Open the post in your app:');
    console.log(`   ${appUrl}/post/${post.id}`);
    console.log('\n   Then click the **Knowledge** tab to see the wiki in action.\n');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
