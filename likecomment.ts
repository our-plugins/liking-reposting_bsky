import { BskyAgent } from '@atproto/api';
import * as fs from 'fs'; // Import the 'fs' module to read files
import * as path from 'path'; // To manage file paths

// Initialize the BskyAgent
const agent = new BskyAgent({
  service: 'https://bsky.social',
});

// Utility function to handle delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to login
async function login(username: string, password: string) {
  try {
    await agent.login({ identifier: username, password });
    console.log(`Login successful for user: ${username}`);
  } catch (error) {
    console.error(`Login failed for user: ${username}`, error);
    process.exit(1);
  }
}

// Function to like a comment
async function likeComment(uri: string, cid: string) {
  try {
    const result = await agent.like(uri, cid);
    console.log(`Liked comment: ${uri}`);
    return result;
  } catch (error) {
    console.error(`Failed to like comment ${uri}:`, error);
  }
}

// Function to load user credentials from a JSON file
function loadUsers(): { username: string, password: string }[] {
  const filePath = path.join(__dirname, 'users.json'); // Ensure users.json is in the same directory
  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData);
}

// Main function
async function main() {
  const users = loadUsers(); // Load users from the JSON file

  // Replace this with the Comment URI and CID to like and reComment
  const targetComment = { uri: 'at://did:plc:w5r6jloi4oug43rlzqi2ndp7/app.bsky.feed.post/3ldowarz45s2m', cid: 'bafyreidkorjsoviwog5itev6rfjs66z7yqf2w347plgna6r6ebfiskcppm' };

  for (const user of users) {
    console.log(`Processing for user: ${user.username}`);

    // Login for each user
    await login(user.username, user.password);

    // Like the Comment
    await likeComment(targetComment.uri, targetComment.cid);

    // Respect rate limits with a delay before switching users
    await delay(2000); // 2-second delay between users to avoid hitting rate limits
  }

  console.log('All operations completed.');
}

// Execute the script
main().catch(error => {
  console.error('Error running script:', error);
});
