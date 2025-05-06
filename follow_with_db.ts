import { BskyAgent } from "@atproto/api";
import { AppBskyActorDefs, AppBskyFeedGetLikes } from "@atproto/api";
import * as readline from "readline";
import * as fs from "fs";
import * as mysql from "mysql2/promise";

// Database connection
const db = mysql.createPool({
  host: '185.198.27.242',    
  user: 'root',
  password: 'AMINOS2025',
  database: 'warmup',
  waitForConnections: true,
  connectionLimit: 10,
});

// Configuration
const MAX_FOLLOWS = 6000; // Max users to follow
const BATCH_SIZE = 20; // Smaller batch size to better handle rate limits
const BATCH_DELAY = 2000; // Increased delay between batches
const FOLLOW_DELAY = 1000; // Increased delay between follows
const LOG_FILE = "follow-log.json";

// Rate limit configuration (Bluesky allows 5000 points per hour)
// Following is a CREATE action worth 3 points
const POINTS_PER_FOLLOW = 3;
const MAX_POINTS_PER_HOUR = 5000;
const MAX_POINTS_PER_DAY = 35000;
const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

// Types
interface UserRecord {
  did: string;
  handle: string;
  alreadyFollowing: boolean;
}

interface RateLimitTracker {
  hourlyPoints: number;
  dailyPoints: number;
  hourlyResetTime: number;
  dailyResetTime: number;
  lastActionTime: number;
}

interface ResponseWithHeaders {
  uri: string;
  cid: string;
  headers?: any;
}

interface AccountRecord {
  id: number;
  username: string;
}

// Initialize rate limit tracker
const rateLimits: RateLimitTracker = {
  hourlyPoints: 0,
  dailyPoints: 0,
  hourlyResetTime: Date.now() + HOUR_IN_MS,
  dailyResetTime: Date.now() + DAY_IN_MS,
  lastActionTime: 0
};

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Mass Follow Tool with Database Integration ===");
  
  try {
    // Test database connection
    await testDatabaseConnection();
    console.log("Database connection successful!");
    
    // Login
    const { agent, agentDID, username } = await login();
    
    // Get account ID from database
    const accountId = await getAccountId(username);
    if (!accountId) {
      console.log(`Account ${username} not found in database. Please add it first.`);
      process.exit(1);
    }
    
    console.log(`Using account ID: ${accountId} (${username})`);
    
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
    
    // Check which users are already in the database
    const filteredUsers = await filterExistingFollowings(accountId, usersToFollow);
    console.log(`${filteredUsers.length} accounts not in your database yet`);
    
    // Calculate rate limit estimations
    const maxFollowsPerHour = Math.floor(MAX_POINTS_PER_HOUR / POINTS_PER_FOLLOW);
    const maxFollowsPerDay = Math.floor(MAX_POINTS_PER_DAY / POINTS_PER_FOLLOW);
    console.log(`Based on rate limits, you can follow up to ${maxFollowsPerHour} accounts per hour or ${maxFollowsPerDay} per day`);
    
    // Preview accounts to follow
    console.log("\nAccounts to follow:");
    filteredUsers.slice(0, 10).forEach((user, i) => {
      console.log(`${i + 1}. ${user.handle} (${user.did})`);
    });
    if (filteredUsers.length > 10) {
      console.log(`... and ${filteredUsers.length - 10} more`);
    }
    
    // Confirm follow
    const confirm = await new Promise<string>(resolve => {
      rl.question(`Do you want to proceed with following ${filteredUsers.length} accounts? (yes/no): `, resolve);
    });
    
    if (confirm.toLowerCase() !== "yes") {
      console.log("Operation cancelled. Exiting.");
      process.exit(0);
    }
    
    // Get rate limit strategy
    const strategy = await new Promise<string>(resolve => {
      rl.question("Choose rate limit strategy: (1) Conservative (slower but safer) or (2) Standard: ", resolve);
    });
    
    const isConservative = strategy === "1";
    if (isConservative) {
      console.log("Using conservative rate limit strategy - this will be slower but more reliable");
    }
    
    // Follow accounts with rate limit handling and database updates
    await followAccountsWithDbUpdates(agent, filteredUsers, isConservative, accountId);
    
    console.log("\nFollow operation completed!");
    await db.end();
    rl.close();
  } catch (error) {
    console.error("Error in main function:", error);
    await db.end();
    process.exit(1);
  }
}

// Test database connection
async function testDatabaseConnection(): Promise<void> {
  try {
    const [rows] = await db.query('SELECT 1');
    return;
  } catch (error) {
    console.error("Database connection error:", error);
    throw new Error("Failed to connect to database");
  }
}

// Get account ID from database
async function getAccountId(username: string): Promise<number | null> {
  try {
    const [rows]: any = await db.query(
      'SELECT id FROM Accounts WHERE username = ?',
      [username]
    );
    
    if (rows.length > 0) {
      return rows[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error getting account ID:", error);
    return null;
  }
}

// Check if user is already in the followings table
async function filterExistingFollowings(accountId: number, users: UserRecord[]): Promise<UserRecord[]> {
  try {
    // Get all users that this account is already following from database
    const [rows]: any = await db.query(
      'SELECT username FROM Followings WHERE account_id = ?',
      [accountId]
    );
    
    // Create a set of usernames for fast lookup
    const existingFollowings = new Set(rows.map((row: any) => row.username));
    
    // Filter out users already in the followings table
    return users.filter(user => !existingFollowings.has(user.handle));
  } catch (error) {
    console.error("Error checking existing followings:", error);
    return users;
  }
}

// Insert new following into database
async function insertFollowing(accountId: number, username: string): Promise<boolean> {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.query(
      'INSERT INTO Followings (username, followed_at, account_id) VALUES (?, ?, ?)',
      [username, now, accountId]
    );
    return true;
  } catch (error) {
    console.error(`Error inserting following for ${username}:`, error);
    return false;
  }
}

// Login function
async function login(): Promise<{ agent: BskyAgent; agentDID: string; username: string }> {
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
    return { agent, agentDID, username: identifier };
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
      
      // Respect rate limits for API calls
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
      
      // Respect rate limits for API calls
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

// Check and update rate limits, returns the delay needed before next action
function updateRateLimits(isConservative: boolean): number {
  const now = Date.now();
  
  // Check if hourly reset is due
  if (now > rateLimits.hourlyResetTime) {
    rateLimits.hourlyPoints = 0;
    rateLimits.hourlyResetTime = now + HOUR_IN_MS;
    console.log("Hourly rate limit reset");
  }
  
  // Check if daily reset is due
  if (now > rateLimits.dailyResetTime) {
    rateLimits.dailyPoints = 0;
    rateLimits.dailyResetTime = now + DAY_IN_MS;
    console.log("Daily rate limit reset");
  }
  
  // Calculate safe thresholds (80% of limits for conservative, 90% for standard)
  const hourlyThreshold = isConservative ? MAX_POINTS_PER_HOUR * 0.8 : MAX_POINTS_PER_HOUR * 0.9;
  const dailyThreshold = isConservative ? MAX_POINTS_PER_DAY * 0.8 : MAX_POINTS_PER_DAY * 0.9;
  
  // Check if we're approaching limits
  if (rateLimits.hourlyPoints >= hourlyThreshold) {
    const timeToHourlyReset = rateLimits.hourlyResetTime - now;
    console.log(`Approaching hourly rate limit. Waiting until reset in ${Math.ceil(timeToHourlyReset/60000)} minutes.`);
    return timeToHourlyReset;
  }
  
  if (rateLimits.dailyPoints >= dailyThreshold) {
    const timeToDailyReset = rateLimits.dailyResetTime - now;
    console.log(`Approaching daily rate limit. Waiting until reset in ${Math.ceil(timeToDailyReset/3600000)} hours.`);
    return timeToDailyReset;
  }
  
  // Calculate minimum time between actions based on rate limits
  // For conservative approach, we'll spread out our actions more
  let minDelay = FOLLOW_DELAY;
  
  if (isConservative) {
    // Calculate how many actions we can do per hour to stay under limit
    const actionsPerHour = Math.floor(hourlyThreshold / POINTS_PER_FOLLOW);
    const safeDelayBetweenActions = Math.ceil(HOUR_IN_MS / actionsPerHour);
    minDelay = Math.max(minDelay, safeDelayBetweenActions);
  }
  
  const timeSinceLastAction = now - rateLimits.lastActionTime;
  return Math.max(0, minDelay - timeSinceLastAction);
}

// Process rate limit headers from response
function processRateLimitHeaders(headers: any): void {
  if (headers && headers['ratelimit-limit'] && headers['ratelimit-remaining'] && headers['ratelimit-reset']) {
    const limit = parseInt(headers['ratelimit-limit']);
    const remaining = parseInt(headers['ratelimit-remaining']);
    const resetTime = parseInt(headers['ratelimit-reset']) * 1000; // Convert to milliseconds
    
    console.log(`Rate limit status: ${remaining}/${limit} remaining, resets at ${new Date(resetTime).toLocaleTimeString()}`);
    
    // If we're close to the limit, we might want to pause
    if (remaining < limit * 0.1) {
      console.log(`WARNING: Only ${remaining} requests remaining until rate limit reset!`);
    }
  }
}

// Follow accounts with rate limit handling and database updates
async function followAccountsWithDbUpdates(
  agent: BskyAgent, 
  toFollow: UserRecord[], 
  isConservative: boolean,
  accountId: number
): Promise<void> {
  const total = toFollow.length;
  let followed = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  let dbSuccesses = 0;
  let dbFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  
  // Estimate time based on rate limits
  const maxFollowsPerHour = Math.floor(MAX_POINTS_PER_HOUR / POINTS_PER_FOLLOW);
  const estimatedHours = Math.ceil(total / maxFollowsPerHour);
  console.log(`Estimated time to follow all accounts: ~${estimatedHours} hour(s)`);
  
  for (let i = 0; i < total; i++) {
    const user = toFollow[i];
    
    // Check rate limits and wait if necessary
    const waitTime = updateRateLimits(isConservative);
    if (waitTime > 0) {
      console.log(`Rate limit protection: waiting for ${Math.ceil(waitTime/1000)} seconds...`);
      await delay(waitTime);
    }
    
    try {
      const beforeFollow = Date.now();
      const response = await agent.follow(user.did);
      const afterFollow = Date.now();
      
      // Process response headers for rate limit info
      const typedResponse = response as ResponseWithHeaders;
      if (typedResponse.headers) {
        processRateLimitHeaders(typedResponse.headers);
      }
      
      // Update rate limit counters
      rateLimits.hourlyPoints += POINTS_PER_FOLLOW;
      rateLimits.dailyPoints += POINTS_PER_FOLLOW;
      rateLimits.lastActionTime = afterFollow;
      
      // Add to database
      const dbResult = await insertFollowing(accountId, user.handle);
      if (dbResult) {
        dbSuccesses++;
      } else {
        dbFailures++;
        console.log(`Failed to save ${user.handle} to database, but follow was successful`);
      }
      
      followed++;
      consecutiveFailures = 0;
      
      // Calculate progress and ETA
      const progress = (followed / total) * 100;
      const remainingUsers = total - followed;
      const avgTimePerUser = (afterFollow - beforeFollow) + FOLLOW_DELAY;
      const estimatedTimeRemaining = remainingUsers * avgTimePerUser;
      
      console.log(`Followed ${user.handle} (${followed}/${total}, ${progress.toFixed(1)}%)`);
      if (remainingUsers > 0) {
        console.log(`Estimated time remaining: ~${formatTime(estimatedTimeRemaining)}`);
      }
      
      // Add jitter to the delay to avoid detection patterns
      const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
      await delay(FOLLOW_DELAY + jitter);
      
    } catch (error: any) {
      failures++;
      consecutiveFailures++;
      
      if (error.error === 'RateLimitExceeded') {
        console.error(`Rate limit exceeded when trying to follow ${user.handle}`);
        
        // Extract rate limit information from headers if available
        if (error.headers) {
          processRateLimitHeaders(error.headers);
          
          // If we have reset time info, wait until reset
          if (error.headers['ratelimit-reset']) {
            const resetTime = parseInt(error.headers['ratelimit-reset']) * 1000;
            const waitTime = resetTime - Date.now() + 5000; // Add 5 seconds buffer
            
            if (waitTime > 0) {
              console.log(`Rate limit exceeded. Waiting until reset: ${formatTime(waitTime)}`);
              await delay(waitTime);
            }
          } else {
            // If no specific reset time, use an exponential backoff
            const backoffTime = Math.min(60000 * Math.pow(2, consecutiveFailures), 3600000); // Max 1 hour
            console.log(`Rate limit exceeded. Backing off for: ${formatTime(backoffTime)}`);
            await delay(backoffTime);
          }
        } else {
          // Default backoff for rate limits if no headers
          const backoffTime = 300000; // 5 minutes
          console.log(`Rate limit exceeded. Backing off for 5 minutes.`);
          await delay(backoffTime);
        }
        
        // Retry this user
        i--;
      } else {
        console.error(`Failed to follow ${user.handle}:`, error);
        
        // If many consecutive failures, take a break
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`${MAX_CONSECUTIVE_FAILURES} consecutive failures detected. Taking a break for 10 minutes.`);
          await delay(600000); // 10 minutes
          consecutiveFailures = 0;
        }
      }
    }
    
    // Print a summary every 10 follows
    if (followed % 10 === 0 && followed > 0) {
      console.log(`\nProgress Update:`);
      console.log(`- Followed: ${followed}/${total} (${((followed/total)*100).toFixed(1)}%)`);
      console.log(`- Failed follows: ${failures}`);
      console.log(`- Successful DB inserts: ${dbSuccesses}`);
      console.log(`- Failed DB inserts: ${dbFailures}`);
      console.log(`- Hourly points used: ${rateLimits.hourlyPoints}/${MAX_POINTS_PER_HOUR}`);
      console.log(`- Daily points used: ${rateLimits.dailyPoints}/${MAX_POINTS_PER_DAY}`);
      console.log(`- Hourly reset: ${new Date(rateLimits.hourlyResetTime).toLocaleTimeString()}`);
      console.log();
    }
  }
  
  // Final summary
  console.log(`\nFollow Operation Complete:`);
  console.log(`- Successfully followed: ${followed}/${total} accounts`);
  console.log(`- Failed follow attempts: ${failures}`);
  console.log(`- Successful DB inserts: ${dbSuccesses}`);
  console.log(`- Failed DB inserts: ${dbFailures}`);
}

// Helper function to format time in human-readable format
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the script
main().catch(error => {
  console.error("Unhandled error:", error);
  db.end();
  process.exit(1);
});