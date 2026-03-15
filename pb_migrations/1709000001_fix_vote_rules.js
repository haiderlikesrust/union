/// 1709000001_fix_vote_rules.js
/// Fix listRule and viewRule for post_votes and comment_votes so users can load their own votes after refresh.

migrate((app) => {
    const postVotes = app.findCollectionByNameOrId("post_votes");
    if (postVotes) {
        postVotes.listRule = "@request.auth.id = user";
        postVotes.viewRule = "@request.auth.id = user";
        app.save(postVotes);
    }

    const commentVotes = app.findCollectionByNameOrId("comment_votes");
    if (commentVotes) {
        commentVotes.listRule = "@request.auth.id = user";
        commentVotes.viewRule = "@request.auth.id = user";
        app.save(commentVotes);
    }
});
