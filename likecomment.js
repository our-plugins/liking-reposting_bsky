"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@atproto/api");
const fs = __importStar(require("fs")); // Import the 'fs' module to read files
const path = __importStar(require("path")); // To manage file paths
// Initialize the BskyAgent
const agent = new api_1.BskyAgent({
    service: 'https://bsky.social',
});
// Utility function to handle delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Function to login
async function login(username, password) {
    try {
        await agent.login({ identifier: username, password });
        console.log(`Login successful for user: ${username}`);
    }
    catch (error) {
        console.error(`Login failed for user: ${username}`, error);
        process.exit(1);
    }
}
// Function to like a comment
async function likeComment(uri, cid) {
    try {
        const result = await agent.like(uri, cid);
        console.log(`Liked comment: ${uri}`);
        return result;
    }
    catch (error) {
        console.error(`Failed to like comment ${uri}:`, error);
    }
}
// Function to load user credentials from a JSON file
function loadUsers() {
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
