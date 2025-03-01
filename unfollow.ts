import { BskyAgent } from "@atproto/api";
import { AppBskyGraphFollow } from "@atproto/api";
import * as readline from "readline";
import * as fs from "fs";

// Configuration
const MAX_FOLLOWS = 30000; // Max follows to fetch
const BATCH_SIZE = 50; // Number of follows to process in a batch (fetching is still done in batches)
const BATCH_DELAY = 1000; // Delay between fetching batches in ms
const UNFOLLOW_DELAY = 500; // Delay between unfollowing each account in ms
const LOG_FILE = "unfollow-log.json";

// Types
interface FollowRecord {
  did: string;
  handle: string;
  uri: string;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Mass Unfollow Tool ===");
  
  // Login
  const { agent, agentDID } = await login();
  
  // Get follows (limit to MAX_FOLLOWS)
  console.log("\nFetching follows...");
  const follows = await fetchFollows(agent, agentDID, MAX_FOLLOWS);
  console.log(`Found ${follows.length} follows (max ${MAX_FOLLOWS})`);
  
  // Save fetched follows to file
//   fs.writeFileSync(LOG_FILE, JSON.stringify(follows, null, 2));
//   console.log(`Saved fetched follows to ${LOG_FILE}`);
  
  // Preview all accounts to unfollow
  console.log("\nUnfollowing all accounts...");
  
  // Confirm unfollow
  const confirm = await new Promise<string>(resolve => {
    rl.question("Do you want to proceed with unfollowing all accounts? (yes/no): ", resolve);
  });
  
  if (confirm.toLowerCase() !== "yes") {
    console.log("Operation cancelled. Exiting.");
    process.exit(0);
  }
  
  // Unfollow all accounts one by one
  await unfollowAccountsOneByOne(agent, agentDID, follows);
  
  console.log("\nUnfollow operation completed!");
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

// Fetch follows, limited to MAX_FOLLOWS
async function fetchFollows(agent: BskyAgent, did: string, maxFollows: number): Promise<FollowRecord[]> {
  const PAGE_LIMIT = 100;
  let cursor: string | undefined = undefined;
  let follows: FollowRecord[] = [];
  let count = 0;
  
  try {
    do {
      const res = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: "app.bsky.graph.follow",
        limit: PAGE_LIMIT,
        cursor,
      });
      
      const records = res.data.records;
      const newFollows = records.map((record: any) => {
        const follow = record.value as AppBskyGraphFollow.Record;
        return {
          did: follow.subject,
          handle: "", // Will be populated later
          uri: record.uri,
        };
      });
      
      follows = [...follows, ...newFollows];
      cursor = res.data.cursor;
      count += records.length;

      if (count >= maxFollows) {
        follows = follows.slice(0, maxFollows); // Limit the result to maxFollows
        break;
      }
      
      console.log(`Fetched ${count} follows...`);
    } while (cursor && count < maxFollows);
    
    return follows;
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return follows; // Return what we have so far
  }
}

// Unfollow accounts one by one
async function unfollowAccountsOneByOne(agent: BskyAgent, did: string, toUnfollow: FollowRecord[]): Promise<void> {
  const total = toUnfollow.length;
  let unfollowed = 0;
  
  for (let i = 0; i < total; i++) {
    const follow = toUnfollow[i];
    
    // Extract rkey from URI (the last part after the slash)
    const parts = follow.uri.split('/');
    const rkey = parts[parts.length - 1];
    
    try {
      await agent.com.atproto.repo.applyWrites({
        repo: did,
        writes: [
          {
            $type: "com.atproto.repo.applyWrites#delete",
            collection: "app.bsky.graph.follow",
            rkey: rkey,
          }
        ],
      });
      
      unfollowed++;
      console.log(`Unfollowed ${unfollowed}/${total} accounts...`);
    } catch (error) {
      console.error(`Failed to unfollow account at index ${i}:`, error);
    }
    
    // Respect delay between unfollows
    if (i + 1 < total) {
      await delay(UNFOLLOW_DELAY);
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
