import { BskyAgent } from "@atproto/api";
import { AppBskyGraphFollow } from "@atproto/api";
import * as readline from "readline";
import * as fs from "fs";

// Configuration
const MAX_FOLLOWS = 20000; // Max follows to fetch
const BATCH_SIZE = 50; // Number of follows to process in a batch (fetching is still done in batches)
const BATCH_DELAY = 1000; // Delay between fetching batches in ms
const LOG_FILE = "unfollow-log.json";

// Rate limit configuration
const HOURLY_POINT_LIMIT = 5000; // 5000 points per hour
const DELETE_COST = 1; // 1 point per DELETE operation
const HOURLY_DELETE_LIMIT = Math.floor(HOURLY_POINT_LIMIT / DELETE_COST); // Max deletes per hour
const BASE_DELAY = 3600 * 1000 / HOURLY_DELETE_LIMIT; // Base delay in ms to stay under hourly limit

// Types
interface FollowRecord {
  did: string;
  handle: string;
  uri: string;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Mass Unfollow Tool (Rate-Limited) ===");
  
  // Login
  const { agent, agentDID } = await login();
  
  // Get follows (limit to MAX_FOLLOWS)
  console.log("\nFetching follows...");
  const follows = await fetchFollows(agent, agentDID, MAX_FOLLOWS);
  console.log(`Found ${follows.length} follows (max ${MAX_FOLLOWS})`);
  
  // Save fetched follows to file
  // fs.writeFileSync(LOG_FILE, JSON.stringify(follows, null, 2));
  // console.log(`Saved fetched follows to ${LOG_FILE}`);
  
  // Preview all accounts to unfollow
  console.log("\nUnfollowing all accounts (with rate limit handling)...");
  console.log(`Rate limit: ${HOURLY_DELETE_LIMIT} unfollows per hour`);
  
  // Confirm unfollow
  const confirm = await new Promise<string>(resolve => {
    rl.question("Do you want to proceed with unfollowing all accounts? (yes/no): ", resolve);
  });
  
  if (confirm.toLowerCase() !== "yes") {
    console.log("Operation cancelled. Exiting.");
    process.exit(0);
  }
  
  // Unfollow all accounts with rate limit handling
  await unfollowAccountsWithRateLimit(agent, agentDID, follows);
  
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
      
      // Add a small delay between fetches to be nice to the API
      if (cursor) {
        await delay(1000);
      }
    } while (cursor && count < maxFollows);
    
    return follows;
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return follows; // Return what we have so far
  }
}

// Parse rate limit headers from the response
function parseRateLimitHeaders(headers: any): RateLimitInfo | null {
  try {
    const limit = parseInt(headers['ratelimit-limit'] || '0');
    const remaining = parseInt(headers['ratelimit-remaining'] || '0');
    const reset = parseInt(headers['ratelimit-reset'] || '0');
    
    if (limit && reset) {
      return { limit, remaining, reset };
    }
  } catch (error) {
    console.warn("Failed to parse rate limit headers:", error);
  }
  
  return null;
}

// Calculate dynamic delay based on rate limit information
function calculateDelay(rateLimitInfo: RateLimitInfo | null): number {
  if (!rateLimitInfo) {
    return BASE_DELAY; // Use default if no rate limit info
  }
  
  const { remaining, reset } = rateLimitInfo;
  
  // Current timestamp in seconds
  const now = Math.floor(Date.now() / 1000);
  
  // Time until reset in seconds
  const timeUntilReset = Math.max(1, reset - now);
  
  if (remaining <= 1) {
    // If we're out of rate limit, wait until reset plus a small buffer
    return (timeUntilReset + 5) * 1000;
  } else {
    // Calculate delay to spread remaining capacity over time until reset
    // Add 10% buffer to be safe
    return (timeUntilReset / remaining) * 1100;
  }
}

// Unfollow accounts with rate limit handling
async function unfollowAccountsWithRateLimit(agent: BskyAgent, did: string, toUnfollow: FollowRecord[]): Promise<void> {
  const total = toUnfollow.length;
  let unfollowed = 0;
  let rateLimitInfo: RateLimitInfo | null = null;
  
  // Initialize with a resume index - useful if the script was interrupted previously
  let startIndex = 0;

  // Allow resuming from a specific index
  const resumeAnswer = await new Promise<string>(resolve => {
    rl.question(`Do you want to resume from a specific index? (0-${total-1}, or 'no'): `, resolve);
  });
  
  if (resumeAnswer.toLowerCase() !== 'no' && !isNaN(parseInt(resumeAnswer))) {
    startIndex = parseInt(resumeAnswer);
    console.log(`Resuming from index ${startIndex}`);
  }
  
  for (let i = startIndex; i < total; i++) {
    const follow = toUnfollow[i];
    
    // Extract rkey from URI (the last part after the slash)
    const parts = follow.uri.split('/');
    const rkey = parts[parts.length - 1];
    
    // Calculate dynamic delay based on rate limit info
    const dynamicDelay = calculateDelay(rateLimitInfo);
    
    try {
      // Log the current status and estimated time
      const remainingItems = total - i;
      const estimatedTimeSeconds = Math.round((remainingItems * dynamicDelay) / 1000);
      const estimatedTimeHours = Math.floor(estimatedTimeSeconds / 3600);
      const estimatedTimeMinutes = Math.floor((estimatedTimeSeconds % 3600) / 60);
      
      console.log(`Processing ${i+1}/${total} (${unfollowed} unfollowed) - Current delay: ${Math.round(dynamicDelay)}ms`);
      console.log(`Estimated time remaining: ${estimatedTimeHours}h ${estimatedTimeMinutes}m`);
      
      const response = await agent.com.atproto.repo.applyWrites({
        repo: did,
        writes: [
          {
            $type: "com.atproto.repo.applyWrites#delete",
            collection: "app.bsky.graph.follow",
            rkey: rkey,
          }
        ],
      });
      
      // Extract rate limit information from headers
      if (response && response.headers) {
        rateLimitInfo = parseRateLimitHeaders(response.headers);
        if (rateLimitInfo && rateLimitInfo.remaining !== undefined) {
          console.log(`Rate limit remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`);
        }
      }
      
      unfollowed++;
      
      // Save progress to file
      const progress = {
        total,
        unfollowed,
        currentIndex: i,
        lastProcessed: new Date().toISOString()
      };
      fs.writeFileSync('unfollow-progress.json', JSON.stringify(progress, null, 2));
      
    } catch (error: any) {
      console.error(`Failed to unfollow account at index ${i}:`, error.message || error);
      
      // Check if this is a rate limit error
      if (error.status === 429 || (error.message && error.message.includes("Rate Limit"))) {
        console.log("Rate limit exceeded. Waiting for reset...");
        
        // Extract rate limit info from error headers if available
        if (error.headers) {
          rateLimitInfo = parseRateLimitHeaders(error.headers);
          
          // If we have reset information, wait until that time plus a buffer
          if (rateLimitInfo && rateLimitInfo.reset) {
            const now = Math.floor(Date.now() / 1000);
            const timeUntilReset = Math.max(10, rateLimitInfo.reset - now);
            const waitMs = (timeUntilReset + 5) * 1000; // Add 5 seconds buffer
            
            console.log(`Waiting ${Math.round(waitMs/1000)} seconds for rate limit to reset...`);
            await delay(waitMs);
            
            // Retry this index
            i--;
            continue;
          }
        }
        
        // If we couldn't extract specific timing, wait for a safe amount of time
        console.log("Waiting 15 minutes before retrying...");
        await delay(15 * 60 * 1000); // 15 minutes
        
        // Retry this index
        i--;
        continue;
      }
    }
    
    // Sleep between unfollows to respect rate limits
    if (i + 1 < total) {
      await delay(dynamicDelay);
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