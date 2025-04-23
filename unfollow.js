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
var fs = require("fs");
// Configuration
var MAX_FOLLOWS = 5000; // Max follows to fetch
var BATCH_SIZE = 50; // Number of follows to process in a batch (fetching is still done in batches)
var BATCH_DELAY = 1000; // Delay between fetching batches in ms
var LOG_FILE = "unfollow-log.json";
// Rate limit configuration
var HOURLY_POINT_LIMIT = 5000; // 5000 points per hour
var DELETE_COST = 1; // 1 point per DELETE operation
var HOURLY_DELETE_LIMIT = Math.floor(HOURLY_POINT_LIMIT / DELETE_COST); // Max deletes per hour
var BASE_DELAY = 3600 * 1000 / HOURLY_DELETE_LIMIT; // Base delay in ms to stay under hourly limit
// Create CLI interface
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, agent, agentDID, follows, confirm;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("=== Bluesky Mass Unfollow Tool (Rate-Limited) ===");
                    return [4 /*yield*/, login()];
                case 1:
                    _a = _b.sent(), agent = _a.agent, agentDID = _a.agentDID;
                    // Get follows (limit to MAX_FOLLOWS)
                    console.log("\nFetching follows...");
                    return [4 /*yield*/, fetchFollows(agent, agentDID, MAX_FOLLOWS)];
                case 2:
                    follows = _b.sent();
                    console.log("Found ".concat(follows.length, " follows (max ").concat(MAX_FOLLOWS, ")"));
                    // Save fetched follows to file
                    // fs.writeFileSync(LOG_FILE, JSON.stringify(follows, null, 2));
                    // console.log(`Saved fetched follows to ${LOG_FILE}`);
                    // Preview all accounts to unfollow
                    console.log("\nUnfollowing all accounts (with rate limit handling)...");
                    console.log("Rate limit: ".concat(HOURLY_DELETE_LIMIT, " unfollows per hour"));
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Do you want to proceed with unfollowing all accounts? (yes/no): ", resolve);
                        })];
                case 3:
                    confirm = _b.sent();
                    if (confirm.toLowerCase() !== "yes") {
                        console.log("Operation cancelled. Exiting.");
                        process.exit(0);
                    }
                    // Unfollow all accounts with rate limit handling
                    return [4 /*yield*/, unfollowAccountsWithRateLimit(agent, agentDID, follows)];
                case 4:
                    // Unfollow all accounts with rate limit handling
                    _b.sent();
                    console.log("\nUnfollow operation completed!");
                    rl.close();
                    return [2 /*return*/];
            }
        });
    });
}
// Login function
function login() {
    return __awaiter(this, void 0, void 0, function () {
        var service, identifier, password, agent, response, agentDID, error_1;
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
                    return [2 /*return*/, { agent: agent, agentDID: agentDID }];
                case 6:
                    error_1 = _a.sent();
                    console.error("Failed to login:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Fetch follows, limited to MAX_FOLLOWS
function fetchFollows(agent, did, maxFollows) {
    return __awaiter(this, void 0, void 0, function () {
        var PAGE_LIMIT, cursor, follows, count, res, records, newFollows, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PAGE_LIMIT = 100;
                    cursor = undefined;
                    follows = [];
                    count = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    _a.label = 2;
                case 2: return [4 /*yield*/, agent.com.atproto.repo.listRecords({
                        repo: did,
                        collection: "app.bsky.graph.follow",
                        limit: PAGE_LIMIT,
                        cursor: cursor,
                    })];
                case 3:
                    res = _a.sent();
                    records = res.data.records;
                    newFollows = records.map(function (record) {
                        var follow = record.value;
                        return {
                            did: follow.subject,
                            handle: "", // Will be populated later
                            uri: record.uri,
                        };
                    });
                    follows = __spreadArray(__spreadArray([], follows, true), newFollows, true);
                    cursor = res.data.cursor;
                    count += records.length;
                    if (count >= maxFollows) {
                        follows = follows.slice(0, maxFollows); // Limit the result to maxFollows
                        return [3 /*break*/, 6];
                    }
                    console.log("Fetched ".concat(count, " follows..."));
                    if (!cursor) return [3 /*break*/, 5];
                    return [4 /*yield*/, delay(1000)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (cursor && count < maxFollows) return [3 /*break*/, 2];
                    _a.label = 6;
                case 6: return [2 /*return*/, follows];
                case 7:
                    error_2 = _a.sent();
                    console.error("Failed to fetch follows:", error_2);
                    return [2 /*return*/, follows]; // Return what we have so far
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Parse rate limit headers from the response
function parseRateLimitHeaders(headers) {
    try {
        var limit = parseInt(headers['ratelimit-limit'] || '0');
        var remaining = parseInt(headers['ratelimit-remaining'] || '0');
        var reset = parseInt(headers['ratelimit-reset'] || '0');
        if (limit && reset) {
            return { limit: limit, remaining: remaining, reset: reset };
        }
    }
    catch (error) {
        console.warn("Failed to parse rate limit headers:", error);
    }
    return null;
}
// Calculate dynamic delay based on rate limit information
function calculateDelay(rateLimitInfo) {
    if (!rateLimitInfo) {
        return BASE_DELAY; // Use default if no rate limit info
    }
    var remaining = rateLimitInfo.remaining, reset = rateLimitInfo.reset;
    // Current timestamp in seconds
    var now = Math.floor(Date.now() / 1000);
    // Time until reset in seconds
    var timeUntilReset = Math.max(1, reset - now);
    if (remaining <= 1) {
        // If we're out of rate limit, wait until reset plus a small buffer
        return (timeUntilReset + 5) * 1000;
    }
    else {
        // Calculate delay to spread remaining capacity over time until reset
        // Add 10% buffer to be safe
        return (timeUntilReset / remaining) * 1100;
    }
}
// Unfollow accounts with rate limit handling
function unfollowAccountsWithRateLimit(agent, did, toUnfollow) {
    return __awaiter(this, void 0, void 0, function () {
        var total, unfollowed, rateLimitInfo, startIndex, resumeAnswer, i, follow, parts, rkey, dynamicDelay, remainingItems, estimatedTimeSeconds, estimatedTimeHours, estimatedTimeMinutes, response, progress, error_3, now, timeUntilReset, waitMs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    total = toUnfollow.length;
                    unfollowed = 0;
                    rateLimitInfo = null;
                    startIndex = 0;
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Do you want to resume from a specific index? (0-".concat(total - 1, ", or 'no'): "), resolve);
                        })];
                case 1:
                    resumeAnswer = _a.sent();
                    if (resumeAnswer.toLowerCase() !== 'no' && !isNaN(parseInt(resumeAnswer))) {
                        startIndex = parseInt(resumeAnswer);
                        console.log("Resuming from index ".concat(startIndex));
                    }
                    i = startIndex;
                    _a.label = 2;
                case 2:
                    if (!(i < total)) return [3 /*break*/, 13];
                    follow = toUnfollow[i];
                    parts = follow.uri.split('/');
                    rkey = parts[parts.length - 1];
                    dynamicDelay = calculateDelay(rateLimitInfo);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 10]);
                    remainingItems = total - i;
                    estimatedTimeSeconds = Math.round((remainingItems * dynamicDelay) / 1000);
                    estimatedTimeHours = Math.floor(estimatedTimeSeconds / 3600);
                    estimatedTimeMinutes = Math.floor((estimatedTimeSeconds % 3600) / 60);
                    console.log("Processing ".concat(i + 1, "/").concat(total, " (").concat(unfollowed, " unfollowed) - Current delay: ").concat(Math.round(dynamicDelay), "ms"));
                    console.log("Estimated time remaining: ".concat(estimatedTimeHours, "h ").concat(estimatedTimeMinutes, "m"));
                    return [4 /*yield*/, agent.com.atproto.repo.applyWrites({
                            repo: did,
                            writes: [
                                {
                                    $type: "com.atproto.repo.applyWrites#delete",
                                    collection: "app.bsky.graph.follow",
                                    rkey: rkey,
                                }
                            ],
                        })];
                case 4:
                    response = _a.sent();
                    // Extract rate limit information from headers
                    if (response && response.headers) {
                        rateLimitInfo = parseRateLimitHeaders(response.headers);
                        if (rateLimitInfo && rateLimitInfo.remaining !== undefined) {
                            console.log("Rate limit remaining: ".concat(rateLimitInfo.remaining, "/").concat(rateLimitInfo.limit));
                        }
                    }
                    unfollowed++;
                    progress = {
                        total: total,
                        unfollowed: unfollowed,
                        currentIndex: i,
                        lastProcessed: new Date().toISOString()
                    };
                    fs.writeFileSync('unfollow-progress.json', JSON.stringify(progress, null, 2));
                    return [3 /*break*/, 10];
                case 5:
                    error_3 = _a.sent();
                    console.error("Failed to unfollow account at index ".concat(i, ":"), error_3.message || error_3);
                    if (!(error_3.status === 429 || (error_3.message && error_3.message.includes("Rate Limit")))) return [3 /*break*/, 9];
                    console.log("Rate limit exceeded. Waiting for reset...");
                    if (!error_3.headers) return [3 /*break*/, 7];
                    rateLimitInfo = parseRateLimitHeaders(error_3.headers);
                    if (!(rateLimitInfo && rateLimitInfo.reset)) return [3 /*break*/, 7];
                    now = Math.floor(Date.now() / 1000);
                    timeUntilReset = Math.max(10, rateLimitInfo.reset - now);
                    waitMs = (timeUntilReset + 5) * 1000;
                    console.log("Waiting ".concat(Math.round(waitMs / 1000), " seconds for rate limit to reset..."));
                    return [4 /*yield*/, delay(waitMs)];
                case 6:
                    _a.sent();
                    // Retry this index
                    i--;
                    return [3 /*break*/, 12];
                case 7:
                    // If we couldn't extract specific timing, wait for a safe amount of time
                    console.log("Waiting 15 minutes before retrying...");
                    return [4 /*yield*/, delay(15 * 60 * 1000)];
                case 8:
                    _a.sent(); // 15 minutes
                    // Retry this index
                    i--;
                    return [3 /*break*/, 12];
                case 9: return [3 /*break*/, 10];
                case 10:
                    if (!(i + 1 < total)) return [3 /*break*/, 12];
                    return [4 /*yield*/, delay(dynamicDelay)];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12:
                    i++;
                    return [3 /*break*/, 2];
                case 13: return [2 /*return*/];
            }
        });
    });
}
// Helper function for delays
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
// Start the script
main().catch(function (error) {
    console.error("Unhandled error:", error);
    process.exit(1);
});
