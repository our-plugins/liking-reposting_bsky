import { BskyAgent } from "@atproto/api";
import { AppBskyActorDefs, AppBskyGraphGetFollows } from "@atproto/api";
import * as readline from "readline";
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

// Types
interface FollowingRecord {
  did: string;
  handle: string;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function
async function main() {
  console.log("=== Bluesky Followings to Database Tool ===");

  try {
    // Test database connection
    await testDatabaseConnection();
    console.log("Database connection successful!");
    
    // Login
    const { agent, agentDID, username } = await login();
    
    // Get account ID from database
    const accountId = await getAccountId(username);
    if (!accountId) {
      console.log(`Account ${username} not found in database. Adding it now...`);
      const newAccountId = await addAccountToDatabase(username);
      if (!newAccountId) {
        console.log("Failed to add account to database. Exiting.");
        process.exit(1);
      }
      console.log(`Added account ${username} with ID ${newAccountId}`);
    }
    
    // Use the account ID we found or created
    const finalAccountId = accountId || await getAccountId(username);
    if (!finalAccountId) {
    console.log("Failed to get or create account ID. Exiting.");
    process.exit(1);
    }
    console.log(`Using account ID: ${finalAccountId} (${username})`);

    // Fetch all followings
    console.log("\nFetching all accounts you're following...");
    const followings = await fetchAllFollowings(agent, agentDID);
    console.log(`Found ${followings.length} accounts you're following`);

    // Store followings in database
    console.log("\nStoring followings in database...");
    const { succeeded, failed } = await storeFollowingsInDatabase(finalAccountId, followings);

    console.log(`\nOperation completed!`);
    console.log(`- Successfully stored: ${succeeded} followings`);
    console.log(`- Failed to store: ${failed} followings`);
    
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

// Add account to database
async function addAccountToDatabase(username: string): Promise<number | null> {
  try {
    const [result]: any = await db.query(
      'INSERT INTO Accounts (username) VALUES (?)',
      [username]
    );
    
    if (result && result.insertId) {
      return result.insertId;
    }
    return null;
  } catch (error) {
    console.error("Error adding account to database:", error);
    return null;
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

// Fetch all accounts the user is following
async function fetchAllFollowings(agent: BskyAgent, did: string): Promise<FollowingRecord[]> {
  const PAGE_LIMIT = 100;
  let cursor: string | undefined = undefined;
  let followings: FollowingRecord[] = [];
  let count = 0;
  
  try {
    do {
      const res = await agent.getFollows({ actor: did, limit: PAGE_LIMIT, cursor }) as AppBskyGraphGetFollows.Response;
      
      // Process followings
      const newFollowings = res.data.follows.map((following: AppBskyActorDefs.ProfileView) => {
        return {
          did: following.did,
          handle: following.handle
        };
      });
      
      followings = [...followings, ...newFollowings];
      cursor = res.data.cursor;
      count += res.data.follows.length;
      
      console.log(`Fetched ${count} followings so far...`);
      
      // Add a small delay to avoid hitting rate limits
      if (cursor) {
        await delay(500);
      }
    } while (cursor);
    
    return followings;
  } catch (error) {
    console.error("Failed to fetch followings:", error);
    return followings; // Return what we have so far
  }
}

// Store followings in database
async function storeFollowingsInDatabase(accountId: number, followings: FollowingRecord[]): Promise<{ succeeded: number, failed: number }> {
  let succeeded = 0;
  let failed = 0;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  // Check which users are already in the database to avoid duplicates
  const [existingRows]: any = await db.query(
    'SELECT username FROM Followings WHERE account_id = ?',
    [accountId]
  );
  
  // Create a set of usernames for fast lookup
  const existingFollowings = new Set(existingRows.map((row: any) => row.username));
  
  // Filter out users already in the followings table
  const newFollowings = followings.filter(user => !existingFollowings.has(user.handle));
  
  console.log(`Found ${newFollowings.length} new followings to add to database`);
  
  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 50;
  for (let i = 0; i < newFollowings.length; i += BATCH_SIZE) {
    const batch = newFollowings.slice(i, i + BATCH_SIZE);
    
    try {
      // Prepare batch insert values
      const values = batch.map(user => [user.handle, now, accountId]);
      
      // Insert batch
      const [result]: any = await db.query(
        'INSERT INTO Followings (username, followed_at, account_id) VALUES ?',
        [values]
      );
      
      succeeded += result.affectedRows;
      console.log(`Stored ${i + result.affectedRows}/${newFollowings.length} followings in database`);
      
      // Add a small delay between batches
      if (i + BATCH_SIZE < newFollowings.length) {
        await delay(200);
      }
    } catch (error) {
      console.error(`Error inserting batch (${i}-${i + batch.length}):`);
      
      // If batch insert fails, try individual inserts
      for (const user of batch) {
        try {
          await db.query(
            'INSERT INTO Followings (username, followed_at, account_id) VALUES (?, ?, ?)',
            [user.handle, now, accountId]
          );
          succeeded++;
        } catch (innerError) {
          failed++;
        }
      }
    }
  }
  
  return { succeeded, failed };
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