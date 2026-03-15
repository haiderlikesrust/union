// EventSource is a browser API; in Node.js we need a polyfill for PocketBase realtime
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.EventSource = require('eventsource');

import PocketBase from 'pocketbase';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Setup OpenAI client with Z.AI
const client = new OpenAI({
    apiKey: process.env.ZAI_API_KEY || 'your-Z.AI-api-key',
    baseURL: 'https://api.z.ai/api/paas/v4/',
});

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://181.214.99.221:8090';
const pb = new PocketBase(POCKETBASE_URL);

// Disable automatic cancellation to prevent interrupted fetch requests in node
pb.autoCancellation(false);

const BOT_EMAIL = process.env.BOT_EMAIL || 'unionforce@theunion.com';
const BOT_PASSWORD = process.env.BOT_PASSWORD || 'unionforce123';
const BOT_USERNAME = process.env.BOT_USERNAME || 'Union_Force';

const BOT_MENTION_REGEX = /@union_force|union force/i;

function isMentionedInText(text) {
    if (!text || typeof text !== 'string') return false;
    return BOT_MENTION_REGEX.test(text);
}

async function generateAIResponse(content, options = {}) {
    const { isCommentReply = false, context } = options;
    const systemPrompt = 'You are Union Force, the friendly AI bot for The Union. Reply in 1–2 short sentences max. Be helpful and slightly witty, never preachy. For moderation: one brief line (e.g. "That\'s not okay here."). No long explanations, no appeals process, no multi-paragraph speeches. Use **bold** only for a single phrase if needed. When replying to a comment, keep it conversational and direct.';
    const userPrompt = isCommentReply && context
        ? `Someone replied or mentioned you. Context: "${context}". They said:\n\n${content}\n\nRespond briefly and naturally.`
        : `A user just posted this. Respond to it nicely or moderate it if needed:\n\n${content}`;
    try {
        const completion = await client.chat.completions.create({
            model: 'glm-5',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });
        return completion.choices[0].message.content.trim();
    } catch (err) {
        console.error('AI Error:', err.message);
        return 'I am currently undergoing maintenance. Bleep bloop. 🤖';
    }
}

async function startBot() {
    console.log('🤖 Starting Union Force Bot...');
    try {
        // Log in to PocketBase as the bot account
        try {
            await pb.collection('users').authWithPassword(BOT_EMAIL, BOT_PASSWORD);
            console.log(`✅ Logged in successfully as ${pb.authStore.model.username}`);
        } catch (err) {
            console.log('Bot user not found, attempting to create one...');
            // Need admin login to create a user if public signup is restricted
            try {
                const newBot = await pb.collection('users').create({
                    username: BOT_USERNAME,
                    email: BOT_EMAIL,
                    password: BOT_PASSWORD,
                    passwordConfirm: BOT_PASSWORD,
                    name: 'Union Force',
                    role: 'bot',
                    karma: 9999
                });
                await pb.collection('users').authWithPassword(BOT_EMAIL, BOT_PASSWORD);
                console.log(`✅ Created and logged in as ${pb.authStore.model.username}`);
            } catch (createErr) {
                console.error('Failed to create bot user. Details:', JSON.stringify(createErr.response?.data || createErr));
                throw createErr;
            }
        }

        const botId = pb.authStore.model?.id ?? pb.authStore.record?.id;

        // Subscribe to new posts
        console.log('👀 Listening for new posts on The Union...');
        const unsubPosts = await pb.collection('posts').subscribe('*', async (e) => {
            if (e.action === 'create') {
                const post = e.record;
                if (post.author === botId) return;

                console.log(`\n🔔 New Post Detected: "${post.title}"`);

                const mentioned = isMentionedInText(post.title) || isMentionedInText(post.body);
                const shouldReply = mentioned || Math.random() < 0.33;

                if (shouldReply) {
                    console.log(`=> Generating response...`);
                    const contentToAnalyze = `${post.title}\n\n${post.body || post.url || ''}`;
                    const reply = await generateAIResponse(contentToAnalyze);

                    try {
                        await pb.collection('comments').create({
                            post: post.id,
                            author: botId,
                            content: reply,
                            score: 1,
                        });
                        console.log(`✅ Replied to post ${post.id}: ${reply.substring(0, 50)}...`);

                        try {
                            await pb.collection('posts').update(post.id, { 'commentCount+': 1 });
                        } catch (updateErr) { /* non-fatal */ }

                        // Upvote posts the bot engages with (when mentioned or when replying)
                        try {
                            await pb.collection('post_votes').create({ post: post.id, user: botId, value: 1 });
                        } catch (voteErr) { /* may already have voted */ }
                    } catch (err) {
                        const status = err?.status ?? err?.response?.code;
                        const detail = err?.response?.message ?? err?.message;
                        console.error(`❌ Failed to post reply (${status || 'error'}): ${detail}`);
                    }
                }
            }
        });

        // Subscribe to new comments: reply when someone replies to the bot or mentions the bot
        console.log('👀 Listening for comments (replies to bot & @mentions)...');
        const unsubComments = await pb.collection('comments').subscribe('*', async (e) => {
            if (e.action !== 'create') return;

            const comment = e.record;
            if (comment.author === botId) return;

            const mentioned = isMentionedInText(comment.content);
            let isReplyToBot = false;
            if (comment.parent) {
                try {
                    const parent = await pb.collection('comments').getOne(comment.parent, { fields: 'author' });
                    if (parent && parent.author === botId) isReplyToBot = true;
                } catch (_) { /* parent deleted or missing */ }
            }

            if (!mentioned && !isReplyToBot) return;

            console.log(`\n💬 Comment ${isReplyToBot ? 'reply to bot' : 'mention'} on post ${comment.post}`);
            const context = isReplyToBot ? 'User replied to your comment' : 'User mentioned you';
            const reply = await generateAIResponse(comment.content, { isCommentReply: true, context });

            try {
                await pb.collection('comments').create({
                    post: comment.post,
                    author: botId,
                    parent: comment.id,
                    content: reply,
                    score: 0,
                });
                console.log(`✅ Replied to comment: ${reply.substring(0, 50)}...`);

                try {
                    await pb.collection('posts').update(comment.post, { 'commentCount+': 1 });
                } catch (updateErr) { /* non-fatal */ }

                // Upvote the comment the bot is replying to
                try {
                    await pb.collection('comment_votes').create({ comment: comment.id, user: botId, value: 1 });
                } catch (voteErr) { /* may already have voted */ }
            } catch (err) {
                const status = err?.status ?? err?.response?.code;
                const detail = err?.response?.message ?? err?.message;
                console.error(`❌ Failed to reply to comment (${status || 'error'}): ${detail}`);
            }
        });

        // Graceful shutdown (helps avoid UV_HANDLE_CLOSING on Windows)
        const shutdown = () => {
            console.log('\n👋 Shutting down bot...');
            if (typeof unsubPosts === 'function') unsubPosts();
            if (typeof unsubComments === 'function') unsubComments();
            pb.realtime?.disconnect?.();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        console.error('❌ Bot startup failed:', err.message);
    }
}

startBot();
