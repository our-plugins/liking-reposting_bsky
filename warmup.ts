import { BskyAgent } from "@atproto/api";
import { AppBskyActorDefs, AppBskyFeedGetLikes } from "@atproto/api";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

// Configuration
const ACCOUNTS_FILE = "accounts.json";
const MAX_FOLLOWS_PER_ACCOUNT = 150; // Each account follows this many users
const BATCH_SIZE = 10; // Process users in batches
const BATCH_DELAY = 3000; // Delay between batches (ms)
const FOLLOW_DELAY = 1500; // Delay between follows (ms)
const ACCOUNT_SWITCH_DELAY = 5000; // Delay when switching accounts (ms)
const LOG_FILE = "warmup-log.json";

// Rate limit configuration
const POINTS_PER_FOLLOW = 3;
const MAX_POINTS_PER_HOUR = 5000;
const MAX_POINTS_PER_DAY = 35000;
const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

// Types
interface AccountCredentials {
  BLUESKY_USERNAME: string;
  BLUESKY_PASSWORD: string;
}

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

interface AccountStatus {
  username: string;
  did: string;
  followsCompleted: number;
  followsAttempted: number;
  rateLimits: RateLimitTracker;
  followedUsers: string[];
}

interface ResponseWithHeaders {
  uri: string;
  cid: string;
  headers?: any;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Multi-Account Follower ===");
  
  // Load accounts from file
  const accounts = loadAccounts();
  console.log(`Loaded ${accounts.length} accounts from ${ACCOUNTS_FILE}`);
  
  // Choose follow mode
  const mode = await chooseMode();
  
  let usersToFollow: UserRecord[] = [];
  const totalFollowLimit = accounts.length * MAX_FOLLOWS_PER_ACCOUNT;
  
  if (mode === "followers") {
    // Get target account DID or handle
    const targetAccount = await new Promise<string>(resolve => {
      rl.question("Enter the DID or handle of the account whose followers you want to follow: ", resolve);
    });
    
    // Load first account just to resolve DID
    console.log(`Logging in to first account to fetch data...`);
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({
      identifier: accounts[0].BLUESKY_USERNAME,
      password: accounts[0].BLUESKY_PASSWORD,
    });
    
    // Resolve handle to DID if needed
    const targetDID = await resolveDID(agent, targetAccount);
    if (!targetDID) {
      console.log("Failed to resolve account. Exiting.");
      process.exit(1);
    }
    
    // Fetch followers
    console.log(`\nFetching followers of ${targetDID}...`);
    usersToFollow = await fetchFollowers(agent, targetDID, totalFollowLimit);
    console.log(`Found ${usersToFollow.length} followers (max ${totalFollowLimit})`);
  } else {
    // Get post URI or AT-URI
    const postURI = await new Promise<string>(resolve => {
      rl.question("Enter the URI or AT-URI of the post whose likers you want to follow: ", resolve);
    });
    
    // Load first account just to fetch data
    console.log(`Logging in to first account to fetch data...`);
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({
      identifier: accounts[0].BLUESKY_USERNAME,
      password: accounts[0].BLUESKY_PASSWORD,
    });
    
    // Fetch likers
    console.log(`\nFetching likers of post...`);
    usersToFollow = await fetchLikers(agent, postURI, totalFollowLimit);
    console.log(`Found ${usersToFollow.length} likers (max ${totalFollowLimit})`);
  }
  
  // Filter out accounts already following
  const notFollowingYet = usersToFollow.filter(user => !user.alreadyFollowing);
  console.log(`${notFollowingYet.length} accounts not following yet`);
  
  // Preview accounts to follow
  console.log("\nAccounts to follow (sample):");
  notFollowingYet.slice(0, 10).forEach((user, i) => {
    console.log(`${i + 1}. ${user.handle} (${user.did})`);
  });
  if (notFollowingYet.length > 10) {
    console.log(`... and ${notFollowingYet.length - 10} more`);
  }
  
  // Calculate distribution across accounts
  const followsPerAccount = Math.min(MAX_FOLLOWS_PER_ACCOUNT, Math.ceil(notFollowingYet.length / accounts.length));
  console.log(`\nEach account will follow approximately ${followsPerAccount} users`);
  
  // Distribute users across accounts
  const accountDistribution = distributeUsersToAccounts(notFollowingYet, accounts.length, followsPerAccount);
  
  // Show distribution plan
  console.log("\nFollow distribution plan:");
  accountDistribution.forEach((users, index) => {
    console.log(`Account ${index + 1} (${accounts[index].BLUESKY_USERNAME}): ${users.length} follows`);
  });
  
  // Confirm follow
  const confirm = await new Promise<string>(resolve => {
    rl.question(`\nDo you want to proceed with following ${notFollowingYet.length} accounts across ${accounts.length} accounts? (yes/no): `, resolve);
  });
  
  if (confirm.toLowerCase() !== "yes") {
    console.log("Operation cancelled. Exiting.");
    process.exit(0);
  }
  
  // Execute follow operations
  const accountStatuses: AccountStatus[] = [];
  
  // Get rate limit strategy
  const strategy = await new Promise<string>(resolve => {
    rl.question("Choose rate limit strategy: (1) Conservative (slower but safer) or (2) Standard: ", resolve);
  });
  
  const isConservative = strategy === "1";
  if (isConservative) {
    console.log("Using conservative rate limit strategy - this will be slower but more reliable");
  }
  
  // Process each account
  for (let i = 0; i < accounts.length; i++) {
    if (accountDistribution[i].length === 0) {
      console.log(`No users to follow for account ${i + 1}, skipping`);
      continue;
    }
    
    console.log(`\n===== Processing account ${i + 1}: ${accounts[i].BLUESKY_USERNAME} =====`);
    
    // Login with account
    const agent = new BskyAgent({ service: "https://bsky.social" });
    try {
      const loginResponse = await agent.login({
        identifier: accounts[i].BLUESKY_USERNAME,
        password: accounts[i].BLUESKY_PASSWORD,
      });
      
      const accountDID = loginResponse.data.did;
      console.log(`Logged in as ${accounts[i].BLUESKY_USERNAME} (${accountDID})`);
      
      // Initialize account status
      const accountStatus: AccountStatus = {
        username: accounts[i].BLUESKY_USERNAME,
        did: accountDID,
        followsCompleted: 0,
        followsAttempted: 0,
        rateLimits: {
          hourlyPoints: 0,
          dailyPoints: 0,
          hourlyResetTime: Date.now() + HOUR_IN_MS,
          dailyResetTime: Date.now() + DAY_IN_MS,
          lastActionTime: 0
        },
        followedUsers: []
      };
      
      // Follow users assigned to this account
      const usersToFollowForThisAccount = accountDistribution[i];
      console.log(`Following ${usersToFollowForThisAccount.length} users with this account`);
      
      await followAccountsWithRateLimits(
        agent, 
        usersToFollowForThisAccount, 
        isConservative, 
        accountStatus
      );
      
      // Add account status to list
      accountStatuses.push(accountStatus);
      
      // Delay before switching to next account
      if (i < accounts.length - 1) {
        console.log(`Waiting ${ACCOUNT_SWITCH_DELAY/1000} seconds before switching to next account...`);
        await delay(ACCOUNT_SWITCH_DELAY);
      }
    } catch (error) {
      console.error(`Failed to login as ${accounts[i].BLUESKY_USERNAME}:`, error);
      console.log("Continuing with next account");
    }
  }
  
  // Save operation log
  const operationLog = {
    timestamp: new Date().toISOString(),
    totalUsersFollowed: accountStatuses.reduce((total, acc) => total + acc.followsCompleted, 0),
    totalAttempted: accountStatuses.reduce((total, acc) => total + acc.followsAttempted, 0),
    accountStatuses
  };
  
  fs.writeFileSync(LOG_FILE, JSON.stringify(operationLog, null, 2));
  console.log(`\nOperation log saved to ${LOG_FILE}`);
  
  console.log("\n===== Follow Operation Summary =====");
  console.log(`Total users followed: ${operationLog.totalUsersFollowed}/${operationLog.totalAttempted}`);
  accountStatuses.forEach(status => {
    console.log(`Account ${status.username}: ${status.followsCompleted}/${status.followsAttempted} follows completed`);
  });
  
  rl.close();
}

// Load accounts from JSON file
function loadAccounts(): AccountCredentials[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      console.error(`Accounts file ${ACCOUNTS_FILE} not found!`);
      process.exit(1);
    }
    
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    const accounts = JSON.parse(data) as AccountCredentials[];
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.error("Accounts file does not contain a valid array of accounts");
      process.exit(1);
    }
    
    // Validate account structure
    accounts.forEach((account, index) => {
      if (!account.BLUESKY_USERNAME || !account.BLUESKY_PASSWORD) {
        console.error(`Account at index ${index} is missing required fields`);
        process.exit(1);
      }
    });
    
    return accounts;
  } catch (error) {
    console.error("Failed to load accounts:", error);
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

// Fetch followers, limited by total
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

// Fetch likers of a post, limited by total
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

// Distribute users across accounts
function distributeUsersToAccounts(users: UserRecord[], numAccounts: number, maxPerAccount: number): UserRecord[][] {
  const distribution: UserRecord[][] = Array(numAccounts).fill(null).map(() => []);
  
  // Shuffle users for more random distribution
  const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
  
  let accountIndex = 0;
  for (const user of shuffledUsers) {
    // If this account has reached its max, move to next account
    if (distribution[accountIndex].length >= maxPerAccount) {
      accountIndex = (accountIndex + 1) % numAccounts;
      
      // If we've gone through all accounts and they're all at max, stop
      if (accountIndex === 0) {
        const allFull = distribution.every(list => list.length >= maxPerAccount);
        if (allFull) break;
      }
    }
    
    distribution[accountIndex].push(user);
    accountIndex = (accountIndex + 1) % numAccounts;
  }
  
  return distribution;
}

// Check and update rate limits, returns the delay needed before next action
function updateRateLimits(tracker: RateLimitTracker, isConservative: boolean): number {
  const now = Date.now();
  
  // Check if hourly reset is due
  if (now > tracker.hourlyResetTime) {
    tracker.hourlyPoints = 0;
    tracker.hourlyResetTime = now + HOUR_IN_MS;
    console.log("Hourly rate limit reset");
  }
  
  // Check if daily reset is due
  if (now > tracker.dailyResetTime) {
    tracker.dailyPoints = 0;
    tracker.dailyResetTime = now + DAY_IN_MS;
    console.log("Daily rate limit reset");
  }
  
  // Calculate safe thresholds (80% of limits for conservative, 90% for standard)
  const hourlyThreshold = isConservative ? MAX_POINTS_PER_HOUR * 0.8 : MAX_POINTS_PER_HOUR * 0.9;
  const dailyThreshold = isConservative ? MAX_POINTS_PER_DAY * 0.8 : MAX_POINTS_PER_DAY * 0.9;
  
  // Check if we're approaching limits
  if (tracker.hourlyPoints >= hourlyThreshold) {
    const timeToHourlyReset = tracker.hourlyResetTime - now;
    console.log(`Approaching hourly rate limit. Waiting until reset in ${Math.ceil(timeToHourlyReset/60000)} minutes.`);
    return timeToHourlyReset;
  }
  
  if (tracker.dailyPoints >= dailyThreshold) {
    const timeToDailyReset = tracker.dailyResetTime - now;
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
  
  const timeSinceLastAction = now - tracker.lastActionTime;
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

// Follow accounts with rate limit handling
async function followAccountsWithRateLimits(
  agent: BskyAgent, 
  toFollow: UserRecord[], 
  isConservative: boolean,
  accountStatus: AccountStatus
): Promise<void> {
  const total = toFollow.length;
  let followed = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  
  for (let i = 0; i < total; i++) {
    const user = toFollow[i];
    accountStatus.followsAttempted++;
    
    // Check if we've already following this user
    if (accountStatus.followedUsers.includes(user.did)) {
      console.log(`Already followed ${user.handle} with this account, skipping.`);
      continue;
    }
    
    // Check rate limits and wait if necessary
    const waitTime = updateRateLimits(accountStatus.rateLimits, isConservative);
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
      accountStatus.rateLimits.hourlyPoints += POINTS_PER_FOLLOW;
      accountStatus.rateLimits.dailyPoints += POINTS_PER_FOLLOW;
      accountStatus.rateLimits.lastActionTime = afterFollow;
      
      // Update account status
      followed++;
      accountStatus.followsCompleted++;
      accountStatus.followedUsers.push(user.did);
      consecutiveFailures = 0;
      
      // Calculate progress
      const progress = (followed / total) * 100;
      
      console.log(`Followed ${user.handle} (${followed}/${total}, ${progress.toFixed(1)}%)`);
      
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
          console.log(`${MAX_CONSECUTIVE_FAILURES} consecutive failures detected. Taking a break for 5 minutes.`);
          await delay(300000); // 5 minutes
          consecutiveFailures = 0;
        }
      }
    }
    
    // Print a summary every 10 follows
    if (followed % 10 === 0 && followed > 0) {
      console.log(`\nProgress Update:`);
      console.log(`- Followed: ${followed}/${total} (${((followed/total)*100).toFixed(1)}%)`);
      console.log(`- Failed: ${failures}`);
      console.log(`- Hourly points used: ${accountStatus.rateLimits.hourlyPoints}/${MAX_POINTS_PER_HOUR}`);
      console.log(`- Daily points used: ${accountStatus.rateLimits.dailyPoints}/${MAX_POINTS_PER_DAY}`);
      console.log(`- Hourly reset: ${new Date(accountStatus.rateLimits.hourlyResetTime).toLocaleTimeString()}`);
      console.log();
    }
  }
  
  // Final summary for this account
  console.log(`\nAccount Operation Complete:`);
  console.log(`- Successfully followed: ${followed}/${total} accounts`);
  console.log(`- Failed attempts: ${failures}`);
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
  process.exit(1);
});