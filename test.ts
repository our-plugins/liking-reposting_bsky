import { BskyAgent } from "@atproto/api";
import { AppBskyGraphFollow } from "@atproto/api";
import * as readline from "readline";
import * as fs from "fs";

// Configuration
const BATCH_SIZE = 50; // Number of follows to process in a batch
const BATCH_DELAY = 1000; // Delay between batches in ms
const UNFOLLOW_BATCH_SIZE = 25; // Number of unfollows to process in a batch
const UNFOLLOW_DELAY = 2000; // Delay between unfollow batches in ms
const LOG_FILE = "unfollow-log.json";

// Types
enum RepoStatus {
  BLOCKEDBY = 1 << 0,
  BLOCKING = 1 << 1,
  DELETED = 1 << 2,
  DEACTIVATED = 1 << 3,
  SUSPENDED = 1 << 4,
  HIDDEN = 1 << 5,
  YOURSELF = 1 << 6,
}

interface FollowRecord {
  did: string;
  handle: string;
  uri: string;
  status?: RepoStatus;
  status_label?: string;
  toDelete?: boolean;
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
  
  // Get follows
  console.log("\nFetching follows...");
  const follows = await fetchAllFollows(agent, agentDID);
  console.log(`Found ${follows.length} follows`);
  
  // Process follows
  console.log("\nProcessing follows to find accounts to unfollow...");
  const processedFollows = await processFollows(agent, follows);
  
  // Save processed follows to file
  fs.writeFileSync(LOG_FILE, JSON.stringify(processedFollows, null, 2));
  console.log(`Saved processed follows to ${LOG_FILE}`);
  
  // Preview accounts to unfollow
  console.log("\nAccounts that can be unfollowed:");
  const unfollowCandidates = processedFollows.filter(f => f.status !== undefined);
  
  // Group by status
  const statusCounts: Record<string, number> = {};
  unfollowCandidates.forEach(f => {
    if (f.status_label) {
      statusCounts[f.status_label] = (statusCounts[f.status_label] || 0) + 1;
    }
  });
  
  // Print status counts
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`- ${status}: ${count}`);
  });
  
  // Ask what to unfollow
  const unfollowOptions = await promptUnfollowOptions(statusCounts);
  const toUnfollow = unfollowCandidates.filter(f => 
    f.status_label && unfollowOptions.includes(f.status_label)
  );
  
  if (toUnfollow.length === 0) {
    console.log("No accounts selected for unfollowing. Exiting.");
    process.exit(0);
  }
  
  console.log(`\nSelected ${toUnfollow.length} accounts to unfollow.`);
  
  // Confirm unfollow
  const confirm = await new Promise<string>(resolve => {
    rl.question("Do you want to proceed with unfollowing? (yes/no): ", resolve);
  });
  
  if (confirm.toLowerCase() !== "yes") {
    console.log("Operation cancelled. Exiting.");
    process.exit(0);
  }
  
  // Unfollow accounts
  console.log("\nUnfollowing accounts...");
  await unfollowAccounts(agent, agentDID, toUnfollow);
  
  console.log("\nUnfollow operation completed!");
  rl.close();
}

// Login function
async function login(): Promise<{ agent: BskyAgent; agentDID: string }> {
  // Get login details
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

// Fetch all follows
async function fetchAllFollows(agent: BskyAgent, did: string): Promise<FollowRecord[]> {
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
      
      console.log(`Fetched ${count} follows...`);
      
      // If we have a cursor and records, continue fetching
    } while (cursor);
    
    return follows;
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return follows; // Return what we have so far
  }
}

// Process follows to determine status
async function processFollows(agent: BskyAgent, follows: FollowRecord[]): Promise<FollowRecord[]> {
  const processedFollows: FollowRecord[] = [];
  const total = follows.length;
  
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = follows.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(total / BATCH_SIZE)}...`);
    
    const promises = batch.map(async (follow) => {
      try {
        const res = await agent.getProfile({ actor: follow.did });
        
        let status: RepoStatus | undefined = undefined;
        follow.handle = res.data.handle;
        const viewer = res.data.viewer;
        
        if (res.data.labels?.some((label: any) => label.val === "!hide")) {
          status = RepoStatus.HIDDEN;
        } else if (viewer?.blockedBy) {
          status = viewer.blocking || viewer.blockingByList
            ? RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING
            : RepoStatus.BLOCKEDBY;
        } else if (viewer?.blocking || viewer?.blockingByList) {
          status = RepoStatus.BLOCKING;
        }
        
        if (status !== undefined) {
          follow.status = status;
          follow.status_label = getStatusLabel(status);
        }
        
        return follow;
      } catch (e: any) {
        // Handle errors by setting appropriate status
        let status: RepoStatus | undefined;
        
        if (e.message?.includes("not found")) {
          status = RepoStatus.DELETED;
        } else if (e.message?.includes("deactivated")) {
          status = RepoStatus.DEACTIVATED;
        } else if (e.message?.includes("suspended")) {
          status = RepoStatus.SUSPENDED;
        }
        
        if (status !== undefined) {
          follow.status = status;
          follow.status_label = getStatusLabel(status);
          
          // Try to resolve handle for deleted/deactivated accounts
          try {
            follow.handle = await resolveDid(follow.did);
          } catch {
            // If we can't resolve, just leave the handle blank
          }
        }
        
        return follow;
      }
    });
    
    processedFollows.push(...await Promise.all(promises));
    
    // Respect rate limits
    if (i + BATCH_SIZE < total) {
      await delay(BATCH_DELAY);
    }
  }
  
  return processedFollows;
}

// Prompt for unfollow options
async function promptUnfollowOptions(statusCounts: Record<string, number>): Promise<string[]> {
  console.log("\nSelect accounts to unfollow by entering numbers separated by commas:");
  
  const options = Object.keys(statusCounts);
  options.forEach((status, index) => {
    console.log(`${index + 1}. ${status} (${statusCounts[status]} accounts)`);
  });
  
  const selection = await new Promise<string>(resolve => {
    rl.question("\nEnter your selection (e.g., 1,3,4): ", resolve);
  });
  
  const selectedIndices = selection
    .split(",")
    .map(s => parseInt(s.trim()) - 1)
    .filter(i => !isNaN(i) && i >= 0 && i < options.length);
  
  return selectedIndices.map(i => options[i]);
}

// Unfollow accounts
async function unfollowAccounts(agent: BskyAgent, did: string, toUnfollow: FollowRecord[]): Promise<void> {
  const total = toUnfollow.length;
  let unfollowed = 0;
  
  for (let i = 0; i < total; i += UNFOLLOW_BATCH_SIZE) {
    const batch = toUnfollow.slice(i, i + UNFOLLOW_BATCH_SIZE);
    
    const writes = batch.map(record => {
      // Extract rkey from URI (the last part after the slash)
      const parts = record.uri.split('/');
      const rkey = parts[parts.length - 1];
      
      return {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.graph.follow",
        rkey: rkey,
      };
    });
    
    try {
      await agent.com.atproto.repo.applyWrites({
        repo: did,
        writes,
      });
      
      unfollowed += batch.length;
      console.log(`Unfollowed ${unfollowed}/${total} accounts...`);
    } catch (error) {
      console.error(`Failed to unfollow batch starting at index ${i}:`, error);
    }
    
    // Respect rate limits
    if (i + UNFOLLOW_BATCH_SIZE < total) {
      await delay(UNFOLLOW_DELAY);
    }
  }
}

// Helper function to get status label
function getStatusLabel(status: RepoStatus): string {
  if (status === RepoStatus.DELETED) return "Deleted";
  if (status === RepoStatus.DEACTIVATED) return "Deactivated";
  if (status === RepoStatus.SUSPENDED) return "Suspended";
  if (status === RepoStatus.BLOCKING) return "Blocking";
  if (status === RepoStatus.BLOCKEDBY) return "Blocked by";
  if (status === RepoStatus.HIDDEN) return "Hidden by moderation";
  if ((status & (RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING)) === 
      (RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING)) return "Mutual Block";
  return "Unknown";
}

// Helper function to resolve DID to handle
async function resolveDid(did: string): Promise<string> {
  try {
    const url = did.startsWith("did:web")
      ? `https://${did.split(":")[2]}/.well-known/did.json`
      : `https://plc.directory/${did}`;
    
    const response = await fetch(url);
    if (!response.ok) return "";
    
    const doc = await response.json();
    
    // For web DIDs
    if (Array.isArray(doc.alsoKnownAs)) {
      for (const alias of doc.alsoKnownAs) {
        if (alias.includes("at://")) {
          return alias.split("//")[1];
        }
      }
    }
    
    return "";
  } catch {
    return "";
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