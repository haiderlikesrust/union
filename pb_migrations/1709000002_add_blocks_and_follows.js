/// 1709000002_add_blocks_and_follows.js
/// Add user_blocks and user_follows collections for block user and follow user features.

migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    if (!users) return;

    const userBlocks = new Collection({
        name: "user_blocks",
        type: "base",
        fields: [
            new Field({ name: "blocker", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "blocked", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
        ],
        listRule: "@request.auth.id = blocker",
        viewRule: "@request.auth.id = blocker",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = blocker",
        deleteRule: "@request.auth.id = blocker",
    });
    app.save(userBlocks);

    const userFollows = new Collection({
        name: "user_follows",
        type: "base",
        fields: [
            new Field({ name: "follower", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
            new Field({ name: "following", type: "relation", required: true, options: { collectionId: users.id, maxSelect: 1 } }),
        ],
        listRule: "@request.auth.id = follower",
        viewRule: "@request.auth.id = follower",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id = follower",
        deleteRule: "@request.auth.id = follower",
    });
    app.save(userFollows);
});
