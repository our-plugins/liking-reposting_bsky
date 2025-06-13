"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("@atproto/api");
var readline = require("readline");
var mysql = require("mysql2/promise");
// Database connection
var db = mysql.createPool({
    host: '185.198.27.242',
    user: 'root',
    password: 'AMINOS2025',
    database: 'warmup',
    waitForConnections: true,
    connectionLimit: 10,
});
// Configuration
var MAX_FOLLOWS = 5000; // Max users to follow was 17000
var BATCH_SIZE = 20; // Smaller batch size to better handle rate limits
var BATCH_DELAY = 2000; // Increased delay between batches
var FOLLOW_DELAY = 1000; // Increased delay between follows
var LOG_FILE = "follow-log.json";
// Rate limit configuration (Bluesky allows 5000 points per hour)
// Following is a CREATE action worth 3 points
var POINTS_PER_FOLLOW = 3;
var MAX_POINTS_PER_HOUR = 5000;
var MAX_POINTS_PER_DAY = 35000;
var HOUR_IN_MS = 60 * 60 * 1000;
var DAY_IN_MS = 24 * HOUR_IN_MS;
// Initialize rate limit tracker
var rateLimits = {
    hourlyPoints: 0,
    dailyPoints: 0,
    hourlyResetTime: Date.now() + HOUR_IN_MS,
    dailyResetTime: Date.now() + DAY_IN_MS,
    lastActionTime: 0
};
// Create CLI interface
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, agent, agentDID, username, accountId, mode, usersToFollow, targetAccount, targetDID, postURI, filteredUsers_1, maxFollowsPerHour, maxFollowsPerDay, confirm_1, strategy, isConservative, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("=== Bluesky Mass Follow Tool with Database Integration ===");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 18, , 20]);
                    // Test database connection
                    return [4 /*yield*/, testDatabaseConnection()];
                case 2:
                    // Test database connection
                    _b.sent();
                    console.log("Database connection successful!");
                    return [4 /*yield*/, login()];
                case 3:
                    _a = _b.sent(), agent = _a.agent, agentDID = _a.agentDID, username = _a.username;
                    return [4 /*yield*/, getAccountId(username)];
                case 4:
                    accountId = _b.sent();
                    if (!accountId) {
                        console.log("Account ".concat(username, " not found in database. Please add it first."));
                        process.exit(1);
                    }
                    console.log("Using account ID: ".concat(accountId, " (").concat(username, ")"));
                    return [4 /*yield*/, chooseMode()];
                case 5:
                    mode = _b.sent();
                    usersToFollow = [];
                    if (!(mode === "followers")) return [3 /*break*/, 9];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Enter the DID or handle of the account whose followers you want to follow: ", resolve);
                        })];
                case 6:
                    targetAccount = _b.sent();
                    return [4 /*yield*/, resolveDID(agent, targetAccount)];
                case 7:
                    targetDID = _b.sent();
                    if (!targetDID) {
                        console.log("Failed to resolve account. Exiting.");
                        process.exit(1);
                    }
                    // Fetch followers
                    console.log("\nFetching followers of ".concat(targetDID, "..."));
                    return [4 /*yield*/, fetchFollowers(agent, targetDID, MAX_FOLLOWS)];
                case 8:
                    usersToFollow = _b.sent();
                    console.log("Found ".concat(usersToFollow.length, " followers (max ").concat(MAX_FOLLOWS, ")"));
                    return [3 /*break*/, 12];
                case 9: return [4 /*yield*/, new Promise(function (resolve) {
                        rl.question("Enter the URI or AT-URI of the post whose likers you want to follow: ", resolve);
                    })];
                case 10:
                    postURI = _b.sent();
                    // Fetch likers
                    console.log("\nFetching likers of post...");
                    return [4 /*yield*/, fetchLikers(agent, postURI, MAX_FOLLOWS)];
                case 11:
                    usersToFollow = _b.sent();
                    console.log("Found ".concat(usersToFollow.length, " likers (max ").concat(MAX_FOLLOWS, ")"));
                    _b.label = 12;
                case 12: return [4 /*yield*/, filterExistingFollowings(accountId, usersToFollow)];
                case 13:
                    filteredUsers_1 = _b.sent();
                    console.log("".concat(filteredUsers_1.length, " accounts not in your database yet"));
                    maxFollowsPerHour = Math.floor(MAX_POINTS_PER_HOUR / POINTS_PER_FOLLOW);
                    maxFollowsPerDay = Math.floor(MAX_POINTS_PER_DAY / POINTS_PER_FOLLOW);
                    console.log("Based on rate limits, you can follow up to ".concat(maxFollowsPerHour, " accounts per hour or ").concat(maxFollowsPerDay, " per day"));
                    // Preview accounts to follow
                    console.log("\nAccounts to follow:");
                    filteredUsers_1.slice(0, 10).forEach(function (user, i) {
                        console.log("".concat(i + 1, ". ").concat(user.handle, " (").concat(user.did, ")"));
                    });
                    if (filteredUsers_1.length > 10) {
                        console.log("... and ".concat(filteredUsers_1.length - 10, " more"));
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Do you want to proceed with following ".concat(filteredUsers_1.length, " accounts? (yes/no): "), resolve);
                        })];
                case 14:
                    confirm_1 = _b.sent();
                    if (confirm_1.toLowerCase() !== "yes") {
                        console.log("Operation cancelled. Exiting.");
                        process.exit(0);
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Choose rate limit strategy: (1) Conservative (slower but safer) or (2) Standard: ", resolve);
                        })];
                case 15:
                    strategy = _b.sent();
                    isConservative = strategy === "1";
                    if (isConservative) {
                        console.log("Using conservative rate limit strategy - this will be slower but more reliable");
                    }
                    // Follow accounts with rate limit handling and database updates
                    return [4 /*yield*/, followAccountsWithDbUpdates(agent, filteredUsers_1, isConservative, accountId)];
                case 16:
                    // Follow accounts with rate limit handling and database updates
                    _b.sent();
                    console.log("\nFollow operation completed!");
                    return [4 /*yield*/, db.end()];
                case 17:
                    _b.sent();
                    rl.close();
                    return [3 /*break*/, 20];
                case 18:
                    error_1 = _b.sent();
                    console.error("Error in main function:", error_1);
                    return [4 /*yield*/, db.end()];
                case 19:
                    _b.sent();
                    process.exit(1);
                    return [3 /*break*/, 20];
                case 20: return [2 /*return*/];
            }
        });
    });
}
// Test database connection
function testDatabaseConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var rows, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db.query('SELECT 1')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/];
                case 2:
                    error_2 = _a.sent();
                    console.error("Database connection error:", error_2);
                    throw new Error("Failed to connect to database");
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Get account ID from database
function getAccountId(username) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db.query('SELECT id FROM Accounts WHERE username = ?', [username])];
                case 1:
                    rows = (_a.sent())[0];
                    if (rows.length > 0) {
                        return [2 /*return*/, rows[0].id];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_3 = _a.sent();
                    console.error("Error getting account ID:", error_3);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Check if user is already in the followings table
function filterExistingFollowings(accountId, users) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, existingFollowings_1, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db.query('SELECT username FROM Followings WHERE account_id = ?', [accountId])];
                case 1:
                    rows = (_a.sent())[0];
                    existingFollowings_1 = new Set(rows.map(function (row) { return row.username; }));
                    // Filter out users already in the followings table
                    return [2 /*return*/, users.filter(function (user) { return !existingFollowings_1.has(user.handle); })];
                case 2:
                    error_4 = _a.sent();
                    console.error("Error checking existing followings:", error_4);
                    return [2 /*return*/, users];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Insert new following into database
function insertFollowing(accountId, username) {
    return __awaiter(this, void 0, void 0, function () {
        var now, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    return [4 /*yield*/, db.query('INSERT INTO Followings (username, followed_at, account_id) VALUES (?, ?, ?)', [username, now, accountId])];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    error_5 = _a.sent();
                    console.error("Error inserting following for ".concat(username, ":"), error_5);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Login function
function login() {
    return __awaiter(this, void 0, void 0, function () {
        var service, identifier, password, agent, response, agentDID, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve) {
                        rl.question("Enter service URL (default: https://bsky.social): ", function (answer) {
                            resolve(answer || "https://bsky.social");
                        });
                    })];
                case 1:
                    service = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Enter handle or DID: ", resolve);
                        })];
                case 2:
                    identifier = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Enter app password: ", resolve);
                        })];
                case 3:
                    password = _a.sent();
                    console.log("Logging in...");
                    agent = new api_1.BskyAgent({ service: service });
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, agent.login({ identifier: identifier, password: password })];
                case 5:
                    response = _a.sent();
                    agentDID = response.data.did;
                    console.log("Logged in as ".concat(agentDID));
                    return [2 /*return*/, { agent: agent, agentDID: agentDID, username: identifier }];
                case 6:
                    error_6 = _a.sent();
                    console.error("Failed to login:", error_6);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Choose mode function
function chooseMode() {
    return __awaiter(this, void 0, void 0, function () {
        var mode;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve) {
                        rl.question("Do you want to follow (1) followers of an account or (2) likers of a post? (1/2): ", resolve);
                    })];
                case 1:
                    mode = _a.sent();
                    if (mode === "1") {
                        return [2 /*return*/, "followers"];
                    }
                    else if (mode === "2") {
                        return [2 /*return*/, "likers"];
                    }
                    else {
                        console.log("Invalid choice. Defaulting to followers mode.");
                        return [2 /*return*/, "followers"];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Resolve handle to DID
function resolveDID(agent, handleOrDID) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (handleOrDID.startsWith("did:")) {
                        return [2 /*return*/, handleOrDID]; // Already a DID
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, agent.resolveHandle({ handle: handleOrDID })];
                case 2:
                    response = _a.sent();
                    return [2 /*return*/, response.data.did];
                case 3:
                    error_7 = _a.sent();
                    console.error("Failed to resolve handle:", error_7);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Fetch followers, limited to MAX_FOLLOWS
function fetchFollowers(agent, did, maxFollows) {
    return __awaiter(this, void 0, void 0, function () {
        var PAGE_LIMIT, cursor, followers, count, res, newFollowers, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PAGE_LIMIT = 100;
                    cursor = undefined;
                    followers = [];
                    count = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    _a.label = 2;
                case 2: return [4 /*yield*/, agent.getFollowers({ actor: did, limit: PAGE_LIMIT, cursor: cursor })];
                case 3:
                    res = _a.sent();
                    newFollowers = res.data.followers.map(function (follower) {
                        var _a;
                        return {
                            did: follower.did,
                            handle: follower.handle,
                            alreadyFollowing: ((_a = follower.viewer) === null || _a === void 0 ? void 0 : _a.following) !== undefined,
                        };
                    });
                    followers = __spreadArray(__spreadArray([], followers, true), newFollowers, true);
                    cursor = res.data.cursor;
                    count += res.data.followers.length;
                    if (count >= maxFollows) {
                        followers = followers.slice(0, maxFollows);
                        return [3 /*break*/, 6];
                    }
                    console.log("Fetched ".concat(count, " followers..."));
                    if (!cursor) return [3 /*break*/, 5];
                    return [4 /*yield*/, delay(BATCH_DELAY)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (cursor && count < maxFollows) return [3 /*break*/, 2];
                    _a.label = 6;
                case 6: return [2 /*return*/, followers];
                case 7:
                    error_8 = _a.sent();
                    console.error("Failed to fetch followers:", error_8);
                    return [2 /*return*/, followers]; // Return what we have so far
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Fetch likers of a post, limited to MAX_FOLLOWS
function fetchLikers(agent, postURI, maxLikes) {
    return __awaiter(this, void 0, void 0, function () {
        var PAGE_LIMIT, cursor, likers, count, match, _, handle, rkey, did, res, newLikers, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PAGE_LIMIT = 100;
                    cursor = undefined;
                    likers = [];
                    count = 0;
                    if (!!postURI.startsWith("at://")) return [3 /*break*/, 5];
                    if (!postURI.includes("bsky.app/profile/")) return [3 /*break*/, 4];
                    match = postURI.match(/bsky\.app\/profile\/([^\/]+)\/post\/([^\/]+)/);
                    if (!match) return [3 /*break*/, 2];
                    _ = match[0], handle = match[1], rkey = match[2];
                    return [4 /*yield*/, resolveDID(agent, handle)];
                case 1:
                    did = _a.sent();
                    if (did) {
                        postURI = "at://".concat(did, "/app.bsky.feed.post/").concat(rkey);
                    }
                    else {
                        console.error("Failed to resolve post URI from web URL");
                        return [2 /*return*/, []];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    console.error("Invalid web URL format");
                    return [2 /*return*/, []];
                case 3: return [3 /*break*/, 5];
                case 4:
                    console.error("Invalid post URI format");
                    return [2 /*return*/, []];
                case 5:
                    _a.trys.push([5, 11, , 12]);
                    _a.label = 6;
                case 6: return [4 /*yield*/, agent.app.bsky.feed.getLikes({ uri: postURI, limit: PAGE_LIMIT, cursor: cursor })];
                case 7:
                    res = _a.sent();
                    newLikers = res.data.likes.map(function (like) {
                        var _a;
                        return {
                            did: like.actor.did,
                            handle: like.actor.handle,
                            alreadyFollowing: ((_a = like.actor.viewer) === null || _a === void 0 ? void 0 : _a.following) !== undefined,
                        };
                    });
                    likers = __spreadArray(__spreadArray([], likers, true), newLikers, true);
                    cursor = res.data.cursor;
                    count += res.data.likes.length;
                    if (count >= maxLikes) {
                        likers = likers.slice(0, maxLikes);
                        return [3 /*break*/, 10];
                    }
                    console.log("Fetched ".concat(count, " likers..."));
                    if (!cursor) return [3 /*break*/, 9];
                    return [4 /*yield*/, delay(BATCH_DELAY)];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    if (cursor && count < maxLikes) return [3 /*break*/, 6];
                    _a.label = 10;
                case 10: return [2 /*return*/, likers];
                case 11:
                    error_9 = _a.sent();
                    console.error("Failed to fetch likers:", error_9);
                    return [2 /*return*/, likers]; // Return what we have so far
                case 12: return [2 /*return*/];
            }
        });
    });
}
// Check and update rate limits, returns the delay needed before next action
function updateRateLimits(isConservative) {
    var now = Date.now();
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
    var hourlyThreshold = isConservative ? MAX_POINTS_PER_HOUR * 0.8 : MAX_POINTS_PER_HOUR * 0.9;
    var dailyThreshold = isConservative ? MAX_POINTS_PER_DAY * 0.8 : MAX_POINTS_PER_DAY * 0.9;
    // Check if we're approaching limits
    if (rateLimits.hourlyPoints >= hourlyThreshold) {
        var timeToHourlyReset = rateLimits.hourlyResetTime - now;
        console.log("Approaching hourly rate limit. Waiting until reset in ".concat(Math.ceil(timeToHourlyReset / 60000), " minutes."));
        return timeToHourlyReset;
    }
    if (rateLimits.dailyPoints >= dailyThreshold) {
        var timeToDailyReset = rateLimits.dailyResetTime - now;
        console.log("Approaching daily rate limit. Waiting until reset in ".concat(Math.ceil(timeToDailyReset / 3600000), " hours."));
        return timeToDailyReset;
    }
    // Calculate minimum time between actions based on rate limits
    // For conservative approach, we'll spread out our actions more
    var minDelay = FOLLOW_DELAY;
    if (isConservative) {
        // Calculate how many actions we can do per hour to stay under limit
        var actionsPerHour = Math.floor(hourlyThreshold / POINTS_PER_FOLLOW);
        var safeDelayBetweenActions = Math.ceil(HOUR_IN_MS / actionsPerHour);
        minDelay = Math.max(minDelay, safeDelayBetweenActions);
    }
    var timeSinceLastAction = now - rateLimits.lastActionTime;
    return Math.max(0, minDelay - timeSinceLastAction);
}
// Process rate limit headers from response
function processRateLimitHeaders(headers) {
    if (headers && headers['ratelimit-limit'] && headers['ratelimit-remaining'] && headers['ratelimit-reset']) {
        var limit = parseInt(headers['ratelimit-limit']);
        var remaining = parseInt(headers['ratelimit-remaining']);
        var resetTime = parseInt(headers['ratelimit-reset']) * 1000; // Convert to milliseconds
        console.log("Rate limit status: ".concat(remaining, "/").concat(limit, " remaining, resets at ").concat(new Date(resetTime).toLocaleTimeString()));
        // If we're close to the limit, we might want to pause
        if (remaining < limit * 0.1) {
            console.log("WARNING: Only ".concat(remaining, " requests remaining until rate limit reset!"));
        }
    }
}
// Follow accounts with rate limit handling and database updates
function followAccountsWithDbUpdates(agent, toFollow, isConservative, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var total, followed, failures, consecutiveFailures, dbSuccesses, dbFailures, MAX_CONSECUTIVE_FAILURES, maxFollowsPerHour, estimatedHours, i, user, waitTime, beforeFollow, response, afterFollow, typedResponse, dbResult, progress, remainingUsers, avgTimePerUser, estimatedTimeRemaining, jitter, error_10, resetTime, waitTime_1, backoffTime, backoffTime;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    total = toFollow.length;
                    followed = 0;
                    failures = 0;
                    consecutiveFailures = 0;
                    dbSuccesses = 0;
                    dbFailures = 0;
                    MAX_CONSECUTIVE_FAILURES = 5;
                    maxFollowsPerHour = Math.floor(MAX_POINTS_PER_HOUR / POINTS_PER_FOLLOW);
                    estimatedHours = Math.ceil(total / maxFollowsPerHour);
                    console.log("Estimated time to follow all accounts: ~".concat(estimatedHours, " hour(s)"));
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < total)) return [3 /*break*/, 21];
                    user = toFollow[i];
                    waitTime = updateRateLimits(isConservative);
                    if (!(waitTime > 0)) return [3 /*break*/, 3];
                    console.log("Rate limit protection: waiting for ".concat(Math.ceil(waitTime / 1000), " seconds..."));
                    return [4 /*yield*/, delay(waitTime)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 7, , 19]);
                    beforeFollow = Date.now();
                    return [4 /*yield*/, agent.follow(user.did)];
                case 4:
                    response = _a.sent();
                    afterFollow = Date.now();
                    typedResponse = response;
                    if (typedResponse.headers) {
                        processRateLimitHeaders(typedResponse.headers);
                    }
                    // Update rate limit counters
                    rateLimits.hourlyPoints += POINTS_PER_FOLLOW;
                    rateLimits.dailyPoints += POINTS_PER_FOLLOW;
                    rateLimits.lastActionTime = afterFollow;
                    return [4 /*yield*/, insertFollowing(accountId, user.handle)];
                case 5:
                    dbResult = _a.sent();
                    if (dbResult) {
                        dbSuccesses++;
                    }
                    else {
                        dbFailures++;
                        console.log("Failed to save ".concat(user.handle, " to database, but follow was successful"));
                    }
                    followed++;
                    consecutiveFailures = 0;
                    progress = (followed / total) * 100;
                    remainingUsers = total - followed;
                    avgTimePerUser = (afterFollow - beforeFollow) + FOLLOW_DELAY;
                    estimatedTimeRemaining = remainingUsers * avgTimePerUser;
                    console.log("Followed ".concat(user.handle, " (").concat(followed, "/").concat(total, ", ").concat(progress.toFixed(1), "%)"));
                    if (remainingUsers > 0) {
                        console.log("Estimated time remaining: ~".concat(formatTime(estimatedTimeRemaining)));
                    }
                    jitter = Math.random() * 1000;
                    return [4 /*yield*/, delay(FOLLOW_DELAY + jitter)];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 19];
                case 7:
                    error_10 = _a.sent();
                    failures++;
                    consecutiveFailures++;
                    if (!(error_10.error === 'RateLimitExceeded')) return [3 /*break*/, 16];
                    console.error("Rate limit exceeded when trying to follow ".concat(user.handle));
                    if (!error_10.headers) return [3 /*break*/, 13];
                    processRateLimitHeaders(error_10.headers);
                    if (!error_10.headers['ratelimit-reset']) return [3 /*break*/, 10];
                    resetTime = parseInt(error_10.headers['ratelimit-reset']) * 1000;
                    waitTime_1 = resetTime - Date.now() + 5000;
                    if (!(waitTime_1 > 0)) return [3 /*break*/, 9];
                    console.log("Rate limit exceeded. Waiting until reset: ".concat(formatTime(waitTime_1)));
                    return [4 /*yield*/, delay(waitTime_1)];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9: return [3 /*break*/, 12];
                case 10:
                    backoffTime = Math.min(60000 * Math.pow(2, consecutiveFailures), 3600000);
                    console.log("Rate limit exceeded. Backing off for: ".concat(formatTime(backoffTime)));
                    return [4 /*yield*/, delay(backoffTime)];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12: return [3 /*break*/, 15];
                case 13:
                    backoffTime = 300000;
                    console.log("Rate limit exceeded. Backing off for 5 minutes.");
                    return [4 /*yield*/, delay(backoffTime)];
                case 14:
                    _a.sent();
                    _a.label = 15;
                case 15:
                    // Retry this user
                    i--;
                    return [3 /*break*/, 18];
                case 16:
                    console.error("Failed to follow ".concat(user.handle, ":"), error_10);
                    if (!(consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)) return [3 /*break*/, 18];
                    console.log("".concat(MAX_CONSECUTIVE_FAILURES, " consecutive failures detected. Taking a break for 10 minutes."));
                    return [4 /*yield*/, delay(600000)];
                case 17:
                    _a.sent(); // 10 minutes
                    consecutiveFailures = 0;
                    _a.label = 18;
                case 18: return [3 /*break*/, 19];
                case 19:
                    // Print a summary every 10 follows
                    if (followed % 10 === 0 && followed > 0) {
                        console.log("\nProgress Update:");
                        console.log("- Followed: ".concat(followed, "/").concat(total, " (").concat(((followed / total) * 100).toFixed(1), "%)"));
                        console.log("- Failed follows: ".concat(failures));
                        console.log("- Successful DB inserts: ".concat(dbSuccesses));
                        console.log("- Failed DB inserts: ".concat(dbFailures));
                        console.log("- Hourly points used: ".concat(rateLimits.hourlyPoints, "/").concat(MAX_POINTS_PER_HOUR));
                        console.log("- Daily points used: ".concat(rateLimits.dailyPoints, "/").concat(MAX_POINTS_PER_DAY));
                        console.log("- Hourly reset: ".concat(new Date(rateLimits.hourlyResetTime).toLocaleTimeString()));
                        console.log();
                    }
                    _a.label = 20;
                case 20:
                    i++;
                    return [3 /*break*/, 1];
                case 21:
                    // Final summary
                    console.log("\nFollow Operation Complete:");
                    console.log("- Successfully followed: ".concat(followed, "/").concat(total, " accounts"));
                    console.log("- Failed follow attempts: ".concat(failures));
                    console.log("- Successful DB inserts: ".concat(dbSuccesses));
                    console.log("- Failed DB inserts: ".concat(dbFailures));
                    return [2 /*return*/];
            }
        });
    });
}
// Helper function to format time in human-readable format
function formatTime(ms) {
    var seconds = Math.floor(ms / 1000) % 60;
    var minutes = Math.floor(ms / (1000 * 60)) % 60;
    var hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) {
        return "".concat(hours, "h ").concat(minutes, "m");
    }
    else if (minutes > 0) {
        return "".concat(minutes, "m ").concat(seconds, "s");
    }
    else {
        return "".concat(seconds, "s");
    }
}
// Helper function for delays
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
// Start the script
main().catch(function (error) {
    console.error("Unhandled error:", error);
    db.end();
    process.exit(1);
});
