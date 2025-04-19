import express from 'express';
import { BskyAgent } from '@atproto/api';
import { AppBskyFeedDefs, AppBskyActorDefs } from '@atproto/api';
import * as fs from 'fs';
import path from 'path';

// Types
interface Account {
  BLUESKY_USERNAME: string;
  BLUESKY_PASSWORD: string;
  agent?: BskyAgent;
  profile?: any;
}

interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  indexedAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  embed?: any;
}

// Create Express app
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// Load accounts from JSON file
function loadAccounts(): Account[] {
  try {
    const data = fs.readFileSync(path.resolve(__dirname, 'accounts.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading accounts:', error);
    return [];
  }
}

// Login to Bluesky
async function loginToBluesky(account: Account): Promise<Account> {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  
  try {
    const response = await agent.login({
      identifier: account.BLUESKY_USERNAME,
      password: account.BLUESKY_PASSWORD
    });
    
    console.log(`Logged in as ${account.BLUESKY_USERNAME}`);
    
    // Get profile information
    const profile = await agent.getProfile({ actor: response.data.handle });
    
    return {
      ...account,
      agent,
      profile: profile.data
    };
  } catch (error) {
    console.error(`Failed to login as ${account.BLUESKY_USERNAME}:`, error);
    return account;
  }
}

// Get user's posts
async function getUserPosts(agent: BskyAgent, did: string, limit: number = 20): Promise<Post[]> {
  try {
    const response = await agent.getAuthorFeed({
      actor: did,
      limit
    });
    
    return response.data.feed.map((item: any) => {
      const post = item.post;
      return {
        uri: post.uri,
        cid: post.cid,
        author: {
          did: post.author.did,
          handle: post.author.handle,
          displayName: post.author.displayName,
          avatar: post.author.avatar
        },
        record: post.record,
        indexedAt: post.indexedAt,
        likeCount: post.likeCount || 0,
        repostCount: post.repostCount || 0,
        replyCount: post.replyCount || 0,
        embed: post.embed
      };
    });
  } catch (error) {
    console.error(`Failed to get posts for ${did}:`, error);
    return [];
  }
}

// Get followers and following counts
async function getFollowCounts(agent: BskyAgent, did: string): Promise<{ followers: number, following: number }> {
  try {
    // Try getting the counts from the profile directly
    const profile = await agent.getProfile({ actor: did });
    console.log('Profile data:', JSON.stringify(profile.data, null, 2));
    
    let followersCount = 1;
    let followingCount = 1;
    
    // Check if the profile contains follower/following counts
    if (profile.data && typeof profile.data.followersCount === 'number') {
      followersCount = profile.data.followersCount;
    }
    
    if (profile.data && typeof profile.data.followsCount === 'number') {
      followingCount = profile.data.followsCount;
    }
    
    console.log(`Extracted from profile - Followers: ${followersCount}, Following: ${followingCount}`);
    
    return {
      followers: followersCount,
      following: followingCount
    };
  } catch (error) {
    console.error(`Failed to get follow counts for ${did}:`, error);
    return { followers: 0, following: 0 };
  }
}

// Generate HTML for accounts
async function generateAccountsHTML(accounts: Account[]): Promise<string> {
  let html = '';
  
  for (const account of accounts) {
    if (!account.agent || !account.profile) {
      html += `<div class="account-container error">
                <h2>${account.BLUESKY_USERNAME}</h2>
                <p>Failed to load account information</p>
              </div>`;
      continue;
    }
    
    const posts = await getUserPosts(account.agent, account.profile.did);
    const followCounts = await getFollowCounts(account.agent, account.profile.did);
    
    // Account header
    html += `
      <div class="account-container">
        <div class="account-header">
          <div class="account-avatar">
            ${account.profile.avatar 
              ? `<img src="${account.profile.avatar}" alt="${account.profile.displayName || account.profile.handle}">`
              : `<div class="avatar-placeholder">${(account.profile.displayName || account.profile.handle).charAt(0)}</div>`
            }
          </div>
          <div class="account-info">
            <h2>${account.profile.displayName || ''}</h2>
            <p class="handle">@${account.profile.handle}</p>
            <p class="description">${account.profile.description || ''}</p>
            <div class="follow-stats">
              <span><strong>${followCounts.following}</strong> Following</span>
              <span><strong>${followCounts.followers}</strong> Followers</span>
            </div>
          </div>
        </div>
        <div class="posts-container">
          <h3>Recent Posts</h3>
    `;
    
    // Posts
    if (posts.length === 0) {
      html += `<p class="no-posts">No posts found</p>`;
    } else {
      for (const post of posts) {
        const date = new Date(post.indexedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        html += `
          <div class="post">
            <div class="post-content">
              <p>${formatPostText(post.record.text)}</p>
              ${post.embed ? formatEmbed(post.embed) : ''}
            </div>
            <div class="post-meta">
              <span class="post-date">${date}</span>
              <div class="post-stats">
                <span title="Likes"><i class="fa fa-heart"></i> ${post.likeCount}</span>
                <span title="Reposts"><i class="fa fa-retweet"></i> ${post.repostCount}</span>
                <span title="Replies"><i class="fa fa-comment"></i> ${post.replyCount}</span>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    html += `
        </div>
      </div>
    `;
  }
  
  return html;
}

// Format post text (handle links, mentions, etc.)
function formatPostText(text: string): string {
  // Convert URLs to links
  text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  
  // Convert mentions to links
  text = text.replace(/@([a-zA-Z0-9.]+)/g, '<a href="https://bsky.app/profile/$1" target="_blank">@$1</a>');
  
  // Handle line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// Format embeds (images, quotes, etc.)
function formatEmbed(embed: any): string {
  let embedHtml = '';
  
  // Handle images
  if (embed.images) {
    embedHtml += '<div class="post-images">';
    for (const image of embed.images) {
      embedHtml += `<img src="${image.fullsize}" alt="${image.alt || ''}" loading="lazy">`;
    }
    embedHtml += '</div>';
  }
  
  // Handle external links
  if (embed.external) {
    embedHtml += `
      <div class="external-link">
        ${embed.external.thumb ? `<img src="${embed.external.thumb}" alt="">` : ''}
        <div class="external-link-content">
          <h4>${embed.external.title || ''}</h4>
          <p>${embed.external.description || ''}</p>
          <span class="external-domain">${new URL(embed.external.uri).hostname}</span>
        </div>
      </div>
    `;
  }
  
  // Handle record (quoted posts)
  if (embed.record) {
    const record = embed.record;
    embedHtml += `
      <div class="quoted-post">
        <div class="quoted-author">
          <span>${record.author?.displayName || record.author?.handle || 'Unknown'}</span>
          <span class="quoted-handle">@${record.author?.handle || ''}</span>
        </div>
        <div class="quoted-content">
          ${record.value?.text ? formatPostText(record.value.text) : ''}
        </div>
      </div>
    `;
  }
  
  return embedHtml;
}

// Generate the main HTML page
function generateHTML(accountsHTML: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bluesky Multi-Account Dashboard</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f8fa;
      color: #14171a;
      line-height: 1.5;
      padding: 20px;
    }
    
    header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    h1 {
      color: #1da1f2;
      margin-bottom: 10px;
    }
    
    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .account-container {
      background-color: #fff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .account-container.error {
      padding: 20px;
      background-color: #ffefef;
      color: #d32f2f;
    }
    
    .account-header {
      display: flex;
      padding: 20px;
      border-bottom: 1px solid #e1e8ed;
    }
    
    .account-avatar {
      margin-right: 15px;
    }
    
    .account-avatar img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .avatar-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: #1da1f2;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
    }
    
    .account-info {
      flex: 1;
    }
    
    .account-info h2 {
      margin-bottom: 5px;
    }
    
    .handle {
      color: #657786;
      margin-bottom: 10px;
    }
    
    .description {
      margin-bottom: 10px;
    }
    
    .follow-stats {
      display: flex;
      gap: 15px;
      color: #657786;
    }
    
    .posts-container {
      padding: 20px;
    }
    
    .posts-container h3 {
      margin-bottom: 15px;
      border-bottom: 1px solid #e1e8ed;
      padding-bottom: 10px;
    }
    
    .no-posts {
      color: #657786;
      font-style: italic;
    }
    
    .post {
      border-bottom: 1px solid #e1e8ed;
      padding: 15px 0;
    }
    
    .post:last-child {
      border-bottom: none;
    }
    
    .post-content {
      margin-bottom: 10px;
    }
    
    .post-meta {
      display: flex;
      justify-content: space-between;
      color: #657786;
      font-size: 0.9em;
    }
    
    .post-stats {
      display: flex;
      gap: 15px;
    }
    
    .post-images {
      margin: 10px 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }
    
    .post-images img {
      width: 100%;
      border-radius: 8px;
      max-height: 300px;
      object-fit: cover;
    }
    
    .external-link {
      display: flex;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .external-link img {
      width: 100px;
      height: 100px;
      object-fit: cover;
    }
    
    .external-link-content {
      padding: 10px;
      flex: 1;
    }
    
    .external-domain {
      font-size: 0.8em;
      color: #657786;
    }
    
    .quoted-post {
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
    }
    
    .quoted-author {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .quoted-handle {
      font-weight: normal;
      color: #657786;
    }
    
    @media (max-width: 768px) {
      .accounts-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Bluesky Multi-Account Dashboard</h1>
    <p>Viewing your Bluesky accounts in one place</p>
  </header>
  
  <div class="accounts-grid">
    ${accountsHTML}
  </div>
  
  <script>
    // Auto-refresh the page every 5 minutes
    setTimeout(() => {
      location.reload();
    }, 5 * 60 * 1000);
  </script>
</body>
</html>
  `;
}

// Main route
app.get('/', async (req, res) => {
  try {
    let accounts = loadAccounts();
    
    // Login to each account
    const loginPromises = accounts.map(account => loginToBluesky(account));
    accounts = await Promise.all(loginPromises);
    
    // Generate HTML
    const accountsHTML = await generateAccountsHTML(accounts);
    const htmlPage = generateHTML(accountsHTML);
    
    res.send(htmlPage);
  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).send('An error occurred while generating the dashboard');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Bluesky Multi-Account Dashboard running on http://localhost:${PORT}`);
});