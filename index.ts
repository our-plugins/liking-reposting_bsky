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

// Function to like a post
async function likePost(uri: string, cid: string) {
  try {
    const result = await agent.like(uri, cid);
    console.log(`Liked post: ${uri}`);
    return result;
  } catch (error) {
    console.error(`Failed to like post ${uri}:`, error);
  }
}

// Function to repost a post
async function repostPost(uri: string, cid: string) {
  try {
    const result = await agent.repost(uri, cid);
    console.log(`Reposted post: ${uri}`);
    return result;
  } catch (error) {
    console.error(`Failed to repost post ${uri}:`, error);
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

  // Replace this with the post URI and CID to like and repost
  const targetPost = { uri: 'at://did:plc:4l7w3rc3yquxhypyrr7njaj5/app.bsky.feed.post/3ldte7mbz722i', cid: 'bafyreibfipfyntvarn42zi5pmyw5u73bpnpqexuprdcsx6nxmwlrlgnp4q' };

  for (const user of users) {
    console.log(`Processing for user: ${user.username}`);

    // Login for each user
    await login(user.username, user.password);

    // Like the post
    await likePost(targetPost.uri, targetPost.cid);

    // Respect rate limits with a delay
    await delay(1000); // 1 second delay; adjust if necessary

    // Repost the post
    await repostPost(targetPost.uri, targetPost.cid);

    // Respect rate limits with a delay before switching users
    await delay(2000); // 2-second delay between users to avoid hitting rate limits
  }

  console.log('All operations completed.');
}

// Execute the script
main().catch(error => {
  console.error('Error running script:', error);
});
