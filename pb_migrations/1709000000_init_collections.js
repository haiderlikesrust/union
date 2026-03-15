/// 1709000000_init_collections.js
/// Auto-generated PocketBase migration for The Union
/// Creates all required collections with proper fields, relations, and access rules.

migrate((app) => {
    // ─── Users collection modifications ─────────────────
    // The 'users' collection already exists by default in PocketBase.
    // We just add extra fields to it.
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(new Field({
        name: "bio",
        type: "text",
        options: { maxSize: 500 },
    }));

    users.fields.add(new Field({
        name: "karma",
        type: "number",
        options: { min: null, max: null },
    }));

    users.fields.add(new Field({
        name: "role",
        type: "select",
        options: {
            values: ["user", "admin", "moderator"],
            maxSelect: 1,
        },
    }));

    app.save(users);

    // ─── Posts ──────────────────────────────────────────
    const posts = new Collection({
        name: "posts",
        type: "base",
        fields: [
            new Field({ name: "title", type: "text", required: true, options: { maxSize: 300 } }),
            new Field({ name: "type", type: "select", required: true, options: { values: ["text", "image", "link"], maxSelect: 1 } }),
            new Field({ name: "body", type: "editor", options: { maxSize: 50000 } }),
            new Field({ name: "image", type: "file", options: { maxSelect: 1, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"] } }),
            new Field({ name: "url", type: "url" }),
            new Field({ name: "author", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "flair", type: "select", options: { values: ["discussion", "question", "news", "meme", "oc", "meta", "announcement"], maxSelect: 1 } }),
            new Field({ name: "score", type: "number", options: { min: null, max: null } }),
            new Field({ name: "commentCount", type: "number", options: { min: 0, max: null } }),
            new Field({ name: "isPinned", type: "bool" }),
        ],
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = author || @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id = author || @request.auth.role = 'admin'",
    });
    app.save(posts);

    // ─── Comments ──────────────────────────────────────
    const comments = new Collection({
        name: "comments",
        type: "base",
        fields: [
            new Field({ name: "content", type: "text", required: true, options: { maxSize: 10000 } }),
            new Field({ name: "post", type: "relation", required: true, options: { collectionId: posts.id, maxSelect: 1 } }),
            new Field({ name: "author", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "parent", type: "relation", options: { maxSelect: 1 } }), // Self-referencing — collectionId set after save
            new Field({ name: "score", type: "number", options: { min: null, max: null } }),
        ],
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = author || @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id = author || @request.auth.role = 'admin'",
    });
    app.save(comments);

    // Update parent field to self-reference
    const parentField = comments.fields.getByName("parent");
    parentField.options.collectionId = comments.id;
    app.save(comments);

    // ─── Post Votes ────────────────────────────────────
    const postVotes = new Collection({
        name: "post_votes",
        type: "base",
        fields: [
            new Field({ name: "post", type: "relation", required: true, options: { collectionId: posts.id, maxSelect: 1 } }),
            new Field({ name: "user", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "value", type: "number", required: true, options: { min: -1, max: 1 } }),
        ],
        listRule: "@request.auth.id = user",
        viewRule: "@request.auth.id = user",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = user",
        deleteRule: "@request.auth.id = user",
    });
    app.save(postVotes);

    // ─── Comment Votes ─────────────────────────────────
    const commentVotes = new Collection({
        name: "comment_votes",
        type: "base",
        fields: [
            new Field({ name: "comment", type: "relation", required: true, options: { collectionId: comments.id, maxSelect: 1 } }),
            new Field({ name: "user", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "value", type: "number", required: true, options: { min: -1, max: 1 } }),
        ],
        listRule: "@request.auth.id = user",
        viewRule: "@request.auth.id = user",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = user",
        deleteRule: "@request.auth.id = user",
    });
    app.save(commentVotes);

    // ─── Saved Posts ───────────────────────────────────
    const savedPosts = new Collection({
        name: "saved_posts",
        type: "base",
        fields: [
            new Field({ name: "post", type: "relation", required: true, options: { collectionId: posts.id, maxSelect: 1 } }),
            new Field({ name: "user", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
        ],
        listRule: "@request.auth.id = user",
        viewRule: "@request.auth.id = user",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = user",
        deleteRule: "@request.auth.id = user",
    });
    app.save(savedPosts);

    // ─── Notifications ─────────────────────────────────
    const notifications = new Collection({
        name: "notifications",
        type: "base",
        fields: [
            new Field({ name: "user", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "type", type: "select", options: { values: ["comment", "reply", "mention", "system"], maxSelect: 1 } }),
            new Field({ name: "sourceUser", type: "relation", options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "post", type: "relation", options: { collectionId: posts.id, maxSelect: 1 } }),
            new Field({ name: "comment", type: "relation", options: { collectionId: comments.id, maxSelect: 1 } }),
            new Field({ name: "message", type: "text", options: { maxSize: 500 } }),
            new Field({ name: "read", type: "bool" }),
        ],
        listRule: "@request.auth.id = user",
        viewRule: "@request.auth.id = user",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = user",
        deleteRule: "@request.auth.id = user",
    });
    app.save(notifications);

    // ─── Reports ───────────────────────────────────────
    const reports = new Collection({
        name: "reports",
        type: "base",
        fields: [
            new Field({ name: "reporter", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "targetType", type: "select", required: true, options: { values: ["post", "comment"], maxSelect: 1 } }),
            new Field({ name: "targetId", type: "text", required: true }),
            new Field({ name: "reason", type: "select", required: true, options: { values: ["spam", "abuse", "harassment", "off-topic"], maxSelect: 1 } }),
            new Field({ name: "details", type: "text", options: { maxSize: 2000 } }),
            new Field({ name: "status", type: "select", options: { values: ["pending", "reviewed", "dismissed"], maxSelect: 1 } }),
        ],
        listRule: "@request.auth.role = 'admin'",
        viewRule: "@request.auth.role = 'admin'",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
    });
    app.save(reports);

    // ─── Bans ──────────────────────────────────────────
    const bans = new Collection({
        name: "bans",
        type: "base",
        fields: [
            new Field({ name: "user", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "reason", type: "text", required: true }),
            new Field({ name: "bannedBy", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "expiresAt", type: "date" }),
        ],
        listRule: "@request.auth.role = 'admin'",
        viewRule: "@request.auth.role = 'admin'",
        createRule: "@request.auth.role = 'admin'",
        updateRule: "@request.auth.role = 'admin'",
        deleteRule: "@request.auth.role = 'admin'",
    });
    app.save(bans);

}, (app) => {
    // Down migration: delete collections in reverse order
    const names = ["bans", "reports", "notifications", "saved_posts", "comment_votes", "post_votes", "comments", "posts"];
    for (const name of names) {
        try {
            const col = app.findCollectionByNameOrId(name);
            app.delete(col);
        } catch (e) {
            // Collection may not exist
        }
    }
});
