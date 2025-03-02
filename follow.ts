import { BskyAgent } from "@atproto/api";
import { AppBskyActorDefs, AppBskyFeedGetLikes } from "@atproto/api";
import * as readline from "readline";
import * as fs from "fs";

// Configuration
const MAX_FOLLOWS = 10000; // Max users to follow
const BATCH_SIZE = 50; // Number of users to process in a batch
const BATCH_DELAY = 1000; // Delay between fetching batches in ms
const FOLLOW_DELAY = 1000; // Delay between following each account in ms
const LOG_FILE = "follow-log.json";

// Types
interface UserRecord {
  did: string;
  handle: string;
  alreadyFollowing: boolean;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Mass Follow Tool ===");
  
  // Login
  const { agent, agentDID } = await login();
  
  // Choose follow mode
  const mode = await chooseMode();
  
  let usersToFollow: UserRecord[] = [];
  
  if (mode === "followers") {
    // Get target account DID or handle
    const targetAccount = await new Promise<string>(resolve => {
      rl.question("Enter the DID or handle of the account whose followers you want to follow: ", resolve);
    });
    
    // Resolve handle to DID if needed
    const targetDID = await resolveDID(agent, targetAccount);
    if (!targetDID) {
      console.log("Failed to resolve account. Exiting.");
      process.exit(1);
    }
    
    // Fetch followers
    console.log(`\nFetching followers of ${targetDID}...`);
    usersToFollow = await fetchFollowers(agent, targetDID, MAX_FOLLOWS);
    console.log(`Found ${usersToFollow.length} followers (max ${MAX_FOLLOWS})`);
  } else {
    // Get post URI or AT-URI
    const postURI = await new Promise<string>(resolve => {
      rl.question("Enter the URI or AT-URI of the post whose likers you want to follow: ", resolve);
    });
    
    // Fetch likers
    console.log(`\nFetching likers of post...`);
    usersToFollow = await fetchLikers(agent, postURI, MAX_FOLLOWS);
    console.log(`Found ${usersToFollow.length} likers (max ${MAX_FOLLOWS})`);
  }
  
  // Filter out accounts already following
  const notFollowingYet = usersToFollow.filter(user => !user.alreadyFollowing);
  console.log(`${notFollowingYet.length} accounts not following yet`);
  
  // Save fetched users to file
  fs.writeFileSync(LOG_FILE, JSON.stringify(notFollowingYet, null, 2));
  console.log(`Saved accounts to follow to ${LOG_FILE}`);
  
  // Preview accounts to follow
  console.log("\nAccounts to follow:");
  notFollowingYet.slice(0, 10).forEach((user, i) => {
    console.log(`${i + 1}. ${user.handle} (${user.did})`);
  });
  if (notFollowingYet.length > 10) {
    console.log(`... and ${notFollowingYet.length - 10} more`);
  }
  
  // Confirm follow
  const confirm = await new Promise<string>(resolve => {
    rl.question(`Do you want to proceed with following ${notFollowingYet.length} accounts? (yes/no): `, resolve);
  });
  
  if (confirm.toLowerCase() !== "yes") {
    console.log("Operation cancelled. Exiting.");
    process.exit(0);
  }
  
  // Follow accounts
  await followAccountsBatch(agent, notFollowingYet);
  
  console.log("\nFollow operation completed!");
  rl.close();
}

// Login function
async function login(): Promise<{ agent: BskyAgent; agentDID: string }> {
  const service = await new Promise<string>(resolve => {
    rl.question("Enter service URL (default: https://bsky.social): ", answer => {
      resolve(answer || "https://bsky.social");
    });
  });
  
  const identifier = await new Promise<string>(resolve => {
    rl.question("Enter handle or DID: ", resolve);
  });
  
  const password = await new Promise<string>(resolve => {
    rl.question("Enter app password: ", resolve);
  });
  
  console.log("Logging in...");
  
  // Create BskyAgent and login
  const agent = new BskyAgent({ service });
  
  try {
    // Try to login directly with handle
    const response = await agent.login({ identifier, password });
    const agentDID = response.data.did;
    console.log(`Logged in as ${agentDID}`);
    return { agent, agentDID };
  } catch (error) {
    console.error("Failed to login:", error);
    process.exit(1);
  }
}

// Choose mode function
async function chooseMode(): Promise<"followers" | "likers"> {
  const mode = await new Promise<string>(resolve => {
    rl.question("Do you want to follow (1) followers of an account or (2) likers of a post? (1/2): ", resolve);
  });
  
  if (mode === "1") {
    return "followers";
  } else if (mode === "2") {
    return "likers";
  } else {
    console.log("Invalid choice. Defaulting to followers mode.");
    return "followers";
  }
}

// Resolve handle to DID
async function resolveDID(agent: BskyAgent, handleOrDID: string): Promise<string | null> {
  if (handleOrDID.startsWith("did:")) {
    return handleOrDID; // Already a DID
  }
  
  try {
    const response = await agent.resolveHandle({ handle: handleOrDID });
    return response.data.did;
  } catch (error) {
    console.error("Failed to resolve handle:", error);
    return null;
  }
}

// Fetch followers, limited to MAX_FOLLOWS
async function fetchFollowers(agent: BskyAgent, did: string, maxFollows: number): Promise<UserRecord[]> {
  const PAGE_LIMIT = 100;
  let cursor: string | undefined = undefined;
  let followers: UserRecord[] = [];
  let count = 0;
  
  try {
    do {
      const res = await agent.getFollowers({ actor: did, limit: PAGE_LIMIT, cursor });
      
      // Process followers
      const newFollowers = res.data.followers.map((follower: AppBskyActorDefs.ProfileView) => {
        return {
          did: follower.did,
          handle: follower.handle,
          alreadyFollowing: follower.viewer?.following !== undefined,
        };
      });
      
      followers = [...followers, ...newFollowers];
      cursor = res.data.cursor;
      count += res.data.followers.length;

      if (count >= maxFollows) {
        followers = followers.slice(0, maxFollows);
        break;
      }
      
      console.log(`Fetched ${count} followers...`);
      
      // Respect rate limits
      if (cursor) {
        await delay(BATCH_DELAY);
      }
    } while (cursor && count < maxFollows);
    
    return followers;
  } catch (error) {
    console.error("Failed to fetch followers:", error);
    return followers; // Return what we have so far
  }
}

// Fetch likers of a post, limited to MAX_FOLLOWS
async function fetchLikers(agent: BskyAgent, postURI: string, maxLikes: number): Promise<UserRecord[]> {
  const PAGE_LIMIT = 100;
  let cursor: string | undefined = undefined;
  let likers: UserRecord[] = [];
  let count = 0;
  
  // Ensure URI is in the right format
  if (!postURI.startsWith("at://")) {
    if (postURI.includes("bsky.app/profile/")) {
      // Convert web URL to AT URI
      const match = postURI.match(/bsky\.app\/profile\/([^\/]+)\/post\/([^\/]+)/);
      if (match) {
        const [_, handle, rkey] = match;
        // First resolve the handle to DID
        const did = await resolveDID(agent, handle);
        if (did) {
          postURI = `at://${did}/app.bsky.feed.post/${rkey}`;
        } else {
          console.error("Failed to resolve post URI from web URL");
          return [];
        }
      } else {
        console.error("Invalid web URL format");
        return [];
      }
    } else {
      console.error("Invalid post URI format");
      return [];
    }
  }
  
  try {
    do {
      const res = await agent.app.bsky.feed.getLikes({ uri: postURI, limit: PAGE_LIMIT, cursor }) as AppBskyFeedGetLikes.Response;
      
      // Process likers
      const newLikers = res.data.likes.map(like => {
        return {
          did: like.actor.did,
          handle: like.actor.handle,
          alreadyFollowing: like.actor.viewer?.following !== undefined,
        };
      });
      
      likers = [...likers, ...newLikers];
      cursor = res.data.cursor;
      count += res.data.likes.length;

      if (count >= maxLikes) {
        likers = likers.slice(0, maxLikes);
        break;
      }
      
      console.log(`Fetched ${count} likers...`);
      
      // Respect rate limits
      if (cursor) {
        await delay(BATCH_DELAY);
      }
    } while (cursor && count < maxLikes);
    
    return likers;
  } catch (error) {
    console.error("Failed to fetch likers:", error);
    return likers; // Return what we have so far
  }
}

// Follow accounts in batches
async function followAccountsBatch(agent: BskyAgent, toFollow: UserRecord[]): Promise<void> {
  const total = toFollow.length;
  let followed = 0;
  
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = toFollow.slice(i, i + BATCH_SIZE);
    
    // Follow each account in the batch
    for (const user of batch) {
      try {
        await agent.follow(user.did);
        followed++;
        console.log(`Followed ${user.handle} (${followed}/${total})`);
      } catch (error) {
        console.error(`Failed to follow ${user.handle}:`, error);
      }
      
      // Respect delay between follows
      if (followed < total) {
        await delay(FOLLOW_DELAY);
      }
    }
    
    console.log(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}`);
    
    // Respect delay between batches
    if (i + BATCH_SIZE < total) {
      await delay(BATCH_DELAY);
    }
  }
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the script
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});