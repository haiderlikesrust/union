/**
 * PocketBase Collection Setup Script for The Union
 * 
 * Run this AFTER starting PocketBase and creating an admin account:
 *   node setup-pb.js <admin-email> <admin-password>
 * 
 * Example:
 *   node setup-pb.js admin@theunion.com mypassword123
 */

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://181.214.99.221:8090';

async function main() {
    const [, , email, password] = process.argv;

    if (!email || !password) {
        console.error('Usage: node setup-pb.js <admin-email> <admin-password>');
        console.error('Example: node setup-pb.js admin@theunion.com mypassword123');
        process.exit(1);
    }

    console.log(`\n🔧 Setting up The Union collections on ${PB_URL}...\n`);

    // 1. Authenticate as admin
    console.log('🔐 Authenticating as admin...');
    const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
    });

    if (!authRes.ok) {
        // Try the newer PocketBase v0.23+ superuser auth
        const superAuthRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: email, password }),
        });
        if (!superAuthRes.ok) {
            console.error('❌ Failed to authenticate. Make sure you created an admin account at:');
            console.error(`   ${PB_URL}/_/`);
            process.exit(1);
        }
        var authData = await superAuthRes.json();
    } else {
        var authData = await authRes.json();
    }

    const token = authData.token;
    console.log('✅ Authenticated!\n');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token,
    };

    // Helper: create a collection
    async function createCollection(schema) {
        const name = schema.name;

        // Check if collection already exists
        const checkRes = await fetch(`${PB_URL}/api/collections/${name}`, { headers });
        if (checkRes.ok) {
            console.log(`   ⏭️  ${name} — already exists, skipping`);
            const existing = await checkRes.json();
            return existing.id;
        }

        const res = await fetch(`${PB_URL}/api/collections`, {
            method: 'POST',
            headers,
            body: JSON.stringify(schema),
        });

        if (!res.ok) {
            const err = await res.json();
            console.error(`   ❌ ${name} — failed:`, JSON.stringify(err, null, 2));
            return null;
        }

        const data = await res.json();
        console.log(`   ✅ ${name} — created (${data.id})`);
        return data.id;
    }

    // Helper: update existing users collection to add custom fields
    // Helper: update existing users collection to add custom fields
    async function updateUsersCollection(badgesCollectionId) {
        // Get the existing users collection
        const res = await fetch(`${PB_URL}/api/collections/users`, { headers });
        if (!res.ok) {
            console.error('   ❌ Could not find users collection');
            return null;
        }
        const users = await res.json();

        // Check if our fields already exist
        const existingFields = (users.fields || users.schema || []).map(f => f.name);
        const fieldsToAdd = [];

        if (!existingFields.includes('bio')) {
            fieldsToAdd.push({ name: 'bio', type: 'text', options: { maxSize: 500 } });
        }
        if (!existingFields.includes('karma')) {
            fieldsToAdd.push({ name: 'karma', type: 'number' });
        }
        if (!existingFields.includes('role')) {
            fieldsToAdd.push({
                name: 'role',
                type: 'select',
                options: { values: ['user', 'admin', 'moderator'], maxSelect: 1 },
            });
        }
        if (!existingFields.includes('banner')) {
            fieldsToAdd.push({
                name: 'banner',
                type: 'file',
                options: { maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] }
            });
        }
        if (!existingFields.includes('badges')) {
            fieldsToAdd.push({
                name: 'badges',
                type: 'relation',
                options: { collectionId: badgesCollectionId, cascadeDelete: false, maxSelect: null } // multiple
            });
        }
        if (!existingFields.includes('e2ePublicKey')) {
            fieldsToAdd.push({ name: 'e2ePublicKey', type: 'text', options: { maxSize: 500 } });
        }

        const updatedFields = [...(users.fields || users.schema || []), ...fieldsToAdd];

        const roleField = updatedFields.find(f => f.name === 'role');
        if (roleField && roleField.options && Array.isArray(roleField.options.values) && !roleField.options.values.includes('bot')) {
            roleField.options.values.push('bot');
        }

        const updateRes = await fetch(`${PB_URL}/api/collections/users`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                fields: updatedFields,
                schema: updatedFields,
                listRule: "",
                viewRule: "",
                // Allow users to update own record, or admins to update any user (e.g. bot profile)
                updateRule: "@request.auth.id = id || @request.auth.role = 'admin'",
            }),
        });

        if (!updateRes.ok) {
            const err = await updateRes.json();
            console.error('   ⚠️  users — could not add custom fields:', JSON.stringify(err));
            console.log('   💡 You may need to add banner (file) and badges (relation) manually via the dashboard');
            return users.id;
        }

        console.log('   ✅ users — added bio, karma, role, banner, badges, e2ePublicKey and update rule (admin can edit any user)');
        return users.id;
    }

    async function updateDmMessagesCollection() {
        const res = await fetch(`${PB_URL}/api/collections/dm_messages`, { headers });
        if (!res.ok) return;
        const col = await res.json();
        const existingFields = (col.fields || col.schema || []).map(f => f.name);
        const toAdd = [];
        if (!existingFields.includes('ciphertext')) toAdd.push({ name: 'ciphertext', type: 'text', options: { maxSize: 10000 } });
        if (!existingFields.includes('nonce')) toAdd.push({ name: 'nonce', type: 'text', options: { maxSize: 200 } });
        if (toAdd.length === 0) return;
        const updatedFields = [...(col.fields || col.schema || []), ...toAdd];
        const patchRes = await fetch(`${PB_URL}/api/collections/dm_messages`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: updatedFields, schema: updatedFields }),
        });
        if (patchRes.ok) console.log('   ✅ dm_messages — added ciphertext, nonce for E2E');
    }

    console.log('\n📦 Creating collections...');

    // ── Step 0: Create badges collection ──
    const badgesId = await createCollection({
        name: 'badges',
        type: 'base',
        schema: [
            { name: 'name', type: 'text', required: true, options: { maxSize: 100 } },
            { name: 'image', type: 'file', required: true, options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'] } },
            { name: 'description', type: 'text', options: { maxSize: 500 } },
            { name: 'tier', type: 'number', required: true },
            { name: 'type', type: 'select', required: true, options: { values: ['user', 'post'], maxSelect: 1 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
    });

    // ── Step 1: Update users collection ──
    console.log('📦 Updating users collection...');
    const usersId = await updateUsersCollection(badgesId);

    // Get users collection ID for relations
    const usersRes = await fetch(`${PB_URL}/api/collections/users`, { headers });
    const usersCol = await usersRes.json();
    const usersColId = usersCol.id;

    // ── Step 2: Create posts collection ──
    console.log('\n📦 Creating collections...');

    const postsId = await createCollection({
        name: 'posts',
        type: 'base',
        schema: [
            { name: 'title', type: 'text', required: true, options: { maxSize: 300 } },
            { name: 'type', type: 'select', required: true, options: { values: ['text', 'image', 'link'], maxSelect: 1 } },
            { name: 'body', type: 'editor', options: { maxSize: 50000 } },
            { name: 'image', type: 'file', options: { maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] } },
            { name: 'url', type: 'url' },
            { name: 'author', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'flair', type: 'select', options: { values: ['discussion', 'question', 'news', 'meme', 'oc', 'meta', 'announcement'], maxSelect: 1 } },
            { name: 'score', type: 'number' },
            { name: 'commentCount', type: 'number', options: { min: 0 } },
            { name: 'isPinned', type: 'bool' },
            { name: 'isLocked', type: 'bool' },
            { name: 'isDeleted', type: 'bool' },
            { name: 'badges', type: 'relation', options: { collectionId: badgesId, cascadeDelete: false, maxSelect: null } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = author || @request.auth.role = "admin"',
        deleteRule: '@request.auth.id = author',
    });

    // ── Step 3: Create comments collection ──
    const commentsId = await createCollection({
        name: 'comments',
        type: 'base',
        schema: [
            { name: 'content', type: 'text', required: true, options: { maxSize: 10000 } },
            { name: 'post', type: 'relation', required: true, options: { collectionId: postsId, maxSelect: 1 } },
            { name: 'author', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'parent', type: 'text' },  // Will store comment ID for nesting  
            { name: 'score', type: 'number' },
            { name: 'isPinned', type: 'bool' },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = author',
        deleteRule: '@request.auth.id = author',
    });

    // ── Step 4: Create post_votes ──
    const postVotesId = await createCollection({
        name: 'post_votes',
        type: 'base',
        schema: [
            { name: 'post', type: 'relation', required: true, options: { collectionId: postsId, maxSelect: 1 } },
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'value', type: 'number', required: true },
        ],
        listRule: '@request.auth.id = user',
        viewRule: '@request.auth.id = user',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    // ── Step 5: Create comment_votes ──
    const commentVotesId = await createCollection({
        name: 'comment_votes',
        type: 'base',
        schema: [
            { name: 'comment', type: 'relation', required: true, options: { collectionId: commentsId, maxSelect: 1 } },
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'value', type: 'number', required: true },
        ],
        listRule: '@request.auth.id = user',
        viewRule: '@request.auth.id = user',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    // ── Step 6: Create saved_posts ──
    await createCollection({
        name: 'saved_posts',
        type: 'base',
        schema: [
            { name: 'post', type: 'relation', required: true, options: { collectionId: postsId, maxSelect: 1 } },
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
        ],
        listRule: '@request.auth.id = user',
        viewRule: '@request.auth.id = user',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    // ── Step 6b: Create user_blocks (block user) ──
    await createCollection({
        name: 'user_blocks',
        type: 'base',
        schema: [
            { name: 'blocker', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'blocked', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
        ],
        listRule: '@request.auth.id = blocker',
        viewRule: '@request.auth.id = blocker',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = blocker',
        deleteRule: '@request.auth.id = blocker',
    });

    // ── Step 6c: Create user_follows (follow user) ──
    await createCollection({
        name: 'user_follows',
        type: 'base',
        schema: [
            { name: 'follower', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'following', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
        ],
        listRule: '@request.auth.id = follower',
        viewRule: '@request.auth.id = follower',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = follower',
        deleteRule: '@request.auth.id = follower',
    });

    // ── Step 7: Create notifications ──
    await createCollection({
        name: 'notifications',
        type: 'base',
        schema: [
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'type', type: 'select', options: { values: ['comment', 'reply', 'mention', 'system'], maxSelect: 1 } },
            { name: 'sourceUser', type: 'relation', options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'post', type: 'relation', options: { collectionId: postsId, maxSelect: 1 } },
            { name: 'comment', type: 'relation', options: { collectionId: commentsId, maxSelect: 1 } },
            { name: 'message', type: 'text', options: { maxSize: 500 } },
            { name: 'read', type: 'bool' },
        ],
        listRule: '@request.auth.id = user',
        viewRule: '@request.auth.id = user',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    // ── Step 8: Create reports ──
    await createCollection({
        name: 'reports',
        type: 'base',
        schema: [
            { name: 'reporter', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'targetType', type: 'select', required: true, options: { values: ['post', 'comment'], maxSelect: 1 } },
            { name: 'targetId', type: 'text', required: true },
            { name: 'reason', type: 'select', required: true, options: { values: ['spam', 'abuse', 'harassment', 'off-topic'], maxSelect: 1 } },
            { name: 'details', type: 'text', options: { maxSize: 2000 } },
            { name: 'status', type: 'select', options: { values: ['pending', 'reviewed', 'dismissed'], maxSelect: 1 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '',
        deleteRule: '',
    });

    // ── Step 9: Create bans ──
    await createCollection({
        name: 'bans',
        type: 'base',
        schema: [
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'reason', type: 'text', required: true },
            { name: 'bannedBy', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'expiresAt', type: 'date' },
        ],
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
    });

    // ── Step 10: Community rules (for sidebar) ──
    await createCollection({
        name: 'community_rules',
        type: 'base',
        schema: [
            { name: 'order', type: 'number', required: true },
            { name: 'title', type: 'text', required: true, options: { maxSize: 200 } },
            { name: 'description', type: 'text', options: { maxSize: 1000 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "moderator"',
    });

    // ── Step 10b: Site branding (logo, banner, name) — single record, public read ──
    await createCollection({
        name: 'site_settings',
        type: 'base',
        schema: [
            { name: 'siteName', type: 'text', options: { maxSize: 100 } },
            { name: 'logo', type: 'file', options: { maxSelect: 1, maxSize: 2097152, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'] } },
            { name: 'banner', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.role = "admin"',
        updateRule: '@request.auth.role = "admin"',
        deleteRule: '@request.auth.role = "admin"',
    });

    // ── Step 11: Knowledge base (community wiki) ──
    const knowledgePagesId = await createCollection({
        name: 'knowledge_pages',
        type: 'base',
        schema: [
            { name: 'post', type: 'relation', required: true, options: { collectionId: postsId, maxSelect: 1 } },
            { name: 'threadSummary', type: 'text', options: { maxSize: 5000 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.role = "admin"',
    });

    const knowledgeSectionsId = await createCollection({
        name: 'knowledge_sections',
        type: 'base',
        schema: [
            { name: 'knowledgePage', type: 'relation', required: true, options: { collectionId: knowledgePagesId, maxSelect: 1 } },
            { name: 'key', type: 'select', required: true, options: { values: ['best_answers', 'best_resources', 'top_comments', 'community_notes', 'thread_summary'], maxSelect: 1 } },
            { name: 'title', type: 'text', required: true, options: { maxSize: 120 } },
            { name: 'order', type: 'number', required: true },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
    });

    const knowledgeEntriesId = await createCollection({
        name: 'knowledge_entries',
        type: 'base',
        schema: [
            { name: 'section', type: 'relation', required: true, options: { collectionId: knowledgeSectionsId, maxSelect: 1 } },
            { name: 'content', type: 'text', required: true, options: { maxSize: 8000 } },
            { name: 'linkUrl', type: 'url' },
            { name: 'score', type: 'number' },
            { name: 'order', type: 'number' },
            { name: 'author', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = author || @request.auth.role = "admin"',
        deleteRule: '@request.auth.id = author || @request.auth.role = "admin"',
    });

    await createCollection({
        name: 'knowledge_votes',
        type: 'base',
        schema: [
            { name: 'entry', type: 'relation', required: true, options: { collectionId: knowledgeEntriesId, maxSelect: 1 } },
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'value', type: 'number', required: true },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    await createCollection({
        name: 'knowledge_edits',
        type: 'base',
        schema: [
            { name: 'entry', type: 'relation', required: true, options: { collectionId: knowledgeEntriesId, maxSelect: 1 } },
            { name: 'editor', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'description', type: 'text', options: { maxSize: 500 } },
        ],
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '',
        deleteRule: '',
    });

    // ── Step 12: DM conversations and messages ──
    const conversationsId = await createCollection({
        name: 'conversations',
        type: 'base',
        schema: [
            { name: 'user1', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'user2', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
        ],
        listRule: 'user1 = @request.auth.id || user2 = @request.auth.id',
        viewRule: 'user1 = @request.auth.id || user2 = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: 'user1 = @request.auth.id || user2 = @request.auth.id',
        deleteRule: 'user1 = @request.auth.id || user2 = @request.auth.id',
    });

    await createCollection({
        name: 'dm_messages',
        type: 'base',
        schema: [
            { name: 'conversation', type: 'relation', required: true, options: { collectionId: conversationsId, maxSelect: 1 } },
            { name: 'sender', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'text', type: 'text', required: true, options: { maxSize: 10000 } },
            { name: 'ciphertext', type: 'text', options: { maxSize: 10000 } },
            { name: 'nonce', type: 'text', options: { maxSize: 200 } },
            { name: 'readAt', type: 'date' },
        ],
        listRule: 'conversation.user1 = @request.auth.id || conversation.user2 = @request.auth.id',
        viewRule: 'conversation.user1 = @request.auth.id || conversation.user2 = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: 'sender = @request.auth.id',
        deleteRule: 'sender = @request.auth.id',
    });

    await updateDmMessagesCollection();

    // ── Step 13: User cloud storage (5GB per user, encrypted at rest) ──
    await createCollection({
        name: 'user_storage',
        type: 'base',
        schema: [
            { name: 'user', type: 'relation', required: true, options: { collectionId: usersColId, maxSelect: 1 } },
            { name: 'file', type: 'file', required: true, options: { maxSelect: 1, maxSize: 104857600 } }, // 100MB per file
            { name: 'name', type: 'text', required: true, options: { maxSize: 512 } },
            { name: 'size', type: 'number', required: true },
            { name: 'mimeType', type: 'text', options: { maxSize: 128 } },
            { name: 'nonce', type: 'text', required: true, options: { maxSize: 64 } },
        ],
        listRule: '@request.auth.id = user',
        viewRule: '@request.auth.id = user',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id = user',
        deleteRule: '@request.auth.id = user',
    });

    console.log('\n🎉 All collections created successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to http://localhost:3000 and sign up');
    console.log('   2. In PocketBase dashboard, edit your user and set role to "admin"');
    console.log('   3. Start posting!\n');
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
