"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@atproto/api");
const agent = new api_1.BskyAgent({
    service: 'https://bsky.social',
});
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function login(username, password) {
    try {
        await agent.login({ identifier: username, password });
        console.log(`Login successful for user: ${username}`);
    }
    catch (error) {
        console.error(`Login failed for user: ${username}`, error);
        process.exit(1);
    }
}
async function getFollows(actor, limit = 50, cursor) {
    const url = "https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows";
    const params = new URLSearchParams({ actor, limit: limit.toString() });
    if (cursor) {
        params.append("cursor", cursor);
    }
    try {
        const response = await fetch(`${url}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch follows: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: "An unknown error occurred" };
    }
}
async function getFollowUri(did) {
    const url = `https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=app.bsky.actor.profile&limit=100`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch follow URI: ${response.status}`);
        }
        const data = await response.json();
        return data.records?.[0]?.uri || null; // Get follow record URI
    }
    catch (error) {
        if (error instanceof Error) {
            return { error: error.message };
        }
        return { error: "An unknown error occurred" };
    }
}
async function unfollowUser(actorHandle) {
    try {
        const followsData = await getFollows(actorHandle);
        if (followsData.error) {
            throw new Error(followsData.error);
        }
        for (const follow of followsData.follows) {
            console.log(`Processing unfollow for: ${follow.handle}`);
            await delay(1000); // Respect rate limits
            console.log(follow.did);
            const followUri = await getFollowUri(follow.did);
            console.log(followUri);
            if (followUri) {
                await agent.deleteFollow(followUri);
                console.log(`Unfollowed: ${follow.handle}`);
            }
            else {
                console.log(`No follow record found for: ${follow.handle}`);
            }
        }
    }
    catch (error) {
        console.error("Error in unfollow process:", error);
    }
}
// ✅ Login before unfollowing
async function main() {
    const BLUESKY_USERNAME = "hlrecipes.bsky.social";
    const BLUESKY_PASSWORD = "AMINOS2000";
    await login(BLUESKY_USERNAME, BLUESKY_PASSWORD);
    const actorHandle = "hlrecipes.bsky.social"; // Changed to your account
    await unfollowUser(actorHandle);
}
main();
