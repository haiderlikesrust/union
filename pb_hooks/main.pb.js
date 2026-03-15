/// <reference path="../pb_data/types.d.ts" />

// ═══════════════════════════════════════════════════════
// THE UNION — PocketBase Server Hooks
// ═══════════════════════════════════════════════════════

// ─── Vote Deduplication & Score Sync (Post Votes) ─────
onRecordBeforeCreateRequest((e) => {
    const userId = e.record.get("user");
    const postId = e.record.get("post");

    // Check for existing vote
    try {
        const existing = $app.dao().findFirstRecordByFilter(
            "post_votes",
            `user = "${userId}" && post = "${postId}"`
        );
        if (existing) {
            // If same value, delete the vote (toggle off)
            if (existing.get("value") === e.record.get("value")) {
                $app.dao().deleteRecord(existing);
                // Update post score
                updatePostScore(postId);
                throw new BadRequestError("Vote removed");
            }
            // If different value, update existing vote
            existing.set("value", e.record.get("value"));
            $app.dao().saveRecord(existing);
            updatePostScore(postId);
            throw new BadRequestError("Vote switched");
        }
    } catch (err) {
        if (err.message === "Vote removed" || err.message === "Vote switched") {
            throw err;
        }
        // No existing vote found, proceed with creation
    }
}, "post_votes");

onRecordAfterCreateRequest((e) => {
    updatePostScore(e.record.get("post"));
    updateUserKarma(getPostAuthor(e.record.get("post")));
}, "post_votes");

onRecordAfterDeleteRequest((e) => {
    updatePostScore(e.record.get("post"));
    updateUserKarma(getPostAuthor(e.record.get("post")));
}, "post_votes");

// ─── Vote Deduplication & Score Sync (Comment Votes) ──
onRecordBeforeCreateRequest((e) => {
    const userId = e.record.get("user");
    const commentId = e.record.get("comment");

    try {
        const existing = $app.dao().findFirstRecordByFilter(
            "comment_votes",
            `user = "${userId}" && comment = "${commentId}"`
        );
        if (existing) {
            if (existing.get("value") === e.record.get("value")) {
                $app.dao().deleteRecord(existing);
                updateCommentScore(commentId);
                throw new BadRequestError("Vote removed");
            }
            existing.set("value", e.record.get("value"));
            $app.dao().saveRecord(existing);
            updateCommentScore(commentId);
            throw new BadRequestError("Vote switched");
        }
    } catch (err) {
        if (err.message === "Vote removed" || err.message === "Vote switched") {
            throw err;
        }
    }
}, "comment_votes");

onRecordAfterCreateRequest((e) => {
    updateCommentScore(e.record.get("comment"));
    updateCommentUserKarma(e.record.get("comment"));
}, "comment_votes");

onRecordAfterDeleteRequest((e) => {
    updateCommentScore(e.record.get("comment"));
    updateCommentUserKarma(e.record.get("comment"));
}, "comment_votes");

// ─── Locked thread: only Union bot and admins/mods can comment (post author cannot) ──
onRecordBeforeCreateRequest((e) => {
    const postId = e.record.get("post");
    const commentAuthorId = e.record.get("author");
    try {
        const post = $app.dao().findRecordById("posts", postId);
        if (!post.get("isLocked")) return;

        const author = $app.dao().findRecordById("users", commentAuthorId);
        const role = author.get("role") || "";
        if (role === "admin" || role === "moderator" || role === "bot") return;

        throw new BadRequestError("This thread is locked. Only the Union bot and moderators can comment.");
    } catch (err) {
        if (err.message && err.message.includes("locked")) throw err;
        // If post/user not found, let the request continue; other validations may catch it
    }
}, "comments");

// ─── Comment Count Sync ──────────────────────────────
onRecordAfterCreateRequest((e) => {
    updatePostCommentCount(e.record.get("post"));

    // Create notification for post author
    createCommentNotification(e.record);
}, "comments");

onRecordAfterDeleteRequest((e) => {
    updatePostCommentCount(e.record.get("post"));
}, "comments");

// ═══════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════

function updatePostScore(postId) {
    try {
        const records = $app.dao().findRecordsByFilter(
            "post_votes",
            `post = "${postId}"`,
            "", 0, 0
        );
        let score = 0;
        for (const r of records) {
            score += r.get("value");
        }
        const post = $app.dao().findRecordById("posts", postId);
        post.set("score", score);
        $app.dao().saveRecord(post);
    } catch (err) {
        console.log("Error updating post score:", err);
    }
}

function updateCommentScore(commentId) {
    try {
        const records = $app.dao().findRecordsByFilter(
            "comment_votes",
            `comment = "${commentId}"`,
            "", 0, 0
        );
        let score = 0;
        for (const r of records) {
            score += r.get("value");
        }
        const comment = $app.dao().findRecordById("comments", commentId);
        comment.set("score", score);
        $app.dao().saveRecord(comment);
    } catch (err) {
        console.log("Error updating comment score:", err);
    }
}

function updatePostCommentCount(postId) {
    try {
        const records = $app.dao().findRecordsByFilter(
            "comments",
            `post = "${postId}"`,
            "", 0, 0
        );
        const post = $app.dao().findRecordById("posts", postId);
        post.set("commentCount", records.length);
        $app.dao().saveRecord(post);
    } catch (err) {
        console.log("Error updating comment count:", err);
    }
}

function getPostAuthor(postId) {
    try {
        const post = $app.dao().findRecordById("posts", postId);
        return post.get("author");
    } catch (err) {
        return "";
    }
}

function updateUserKarma(userId) {
    if (!userId) return;
    try {
        // Sum up all post scores for this user
        const posts = $app.dao().findRecordsByFilter(
            "posts",
            `author = "${userId}"`,
            "", 0, 0
        );
        let karma = 0;
        for (const p of posts) {
            karma += p.get("score");
        }
        // Also add comment scores
        const comments = $app.dao().findRecordsByFilter(
            "comments",
            `author = "${userId}"`,
            "", 0, 0
        );
        for (const c of comments) {
            karma += c.get("score");
        }
        const user = $app.dao().findRecordById("users", userId);
        user.set("karma", karma);
        $app.dao().saveRecord(user);
    } catch (err) {
        console.log("Error updating karma:", err);
    }
}

function updateCommentUserKarma(commentId) {
    try {
        const comment = $app.dao().findRecordById("comments", commentId);
        updateUserKarma(comment.get("author"));
    } catch (err) {
        console.log("Error updating comment user karma:", err);
    }
}

function createCommentNotification(commentRecord) {
    try {
        const postId = commentRecord.get("post");
        const commentAuthor = commentRecord.get("author");
        const parentId = commentRecord.get("parent");

        const post = $app.dao().findRecordById("posts", postId);
        const postAuthor = post.get("author");

        // Don't notify yourself
        if (commentAuthor === postAuthor && !parentId) return;

        const notifCollection = $app.dao().findCollectionByNameOrId("notifications");

        if (parentId) {
            // Reply notification - notify parent comment author
            try {
                const parentComment = $app.dao().findRecordById("comments", parentId);
                const parentAuthor = parentComment.get("author");
                if (parentAuthor !== commentAuthor) {
                    const notif = new Record(notifCollection);
                    notif.set("user", parentAuthor);
                    notif.set("type", "reply");
                    notif.set("sourceUser", commentAuthor);
                    notif.set("post", postId);
                    notif.set("comment", commentRecord.getId());
                    notif.set("message", "replied to your comment");
                    notif.set("read", false);
                    $app.dao().saveRecord(notif);
                }
            } catch (err) {
                console.log("Error creating reply notification:", err);
            }
        }

        // Always notify post author about new comments (unless it's the post author commenting)
        if (postAuthor !== commentAuthor) {
            const notif = new Record(notifCollection);
            notif.set("user", postAuthor);
            notif.set("type", "comment");
            notif.set("sourceUser", commentAuthor);
            notif.set("post", postId);
            notif.set("comment", commentRecord.getId());
            notif.set("message", "commented on your post");
            notif.set("read", false);
            $app.dao().saveRecord(notif);
        }
    } catch (err) {
        console.log("Error creating notification:", err);
    }
}
