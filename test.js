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
var BATCH_SIZE = 50; // Number of follows to process in a batch
var BATCH_DELAY = 1000; // Delay between batches in ms
var UNFOLLOW_BATCH_SIZE = 25; // Number of unfollows to process in a batch
var UNFOLLOW_DELAY = 2000; // Delay between unfollow batches in ms
var LOG_FILE = "unfollow-log.json";
// Types
var RepoStatus;
(function (RepoStatus) {
    RepoStatus[RepoStatus["BLOCKEDBY"] = 1] = "BLOCKEDBY";
    RepoStatus[RepoStatus["BLOCKING"] = 2] = "BLOCKING";
    RepoStatus[RepoStatus["DELETED"] = 4] = "DELETED";
    RepoStatus[RepoStatus["DEACTIVATED"] = 8] = "DEACTIVATED";
    RepoStatus[RepoStatus["SUSPENDED"] = 16] = "SUSPENDED";
    RepoStatus[RepoStatus["HIDDEN"] = 32] = "HIDDEN";
    RepoStatus[RepoStatus["YOURSELF"] = 64] = "YOURSELF";
})(RepoStatus || (RepoStatus = {}));
// Create CLI interface
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, agent, agentDID, follows, processedFollows, unfollowCandidates, statusCounts, unfollowOptions, toUnfollow, confirm;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("=== Bluesky Mass Unfollow Tool ===");
                    return [4 /*yield*/, login()];
                case 1:
                    _a = _b.sent(), agent = _a.agent, agentDID = _a.agentDID;
                    // Get follows
                    console.log("\nFetching follows...");
                    return [4 /*yield*/, fetchAllFollows(agent, agentDID)];
                case 2:
                    follows = _b.sent();
                    console.log("Found ".concat(follows.length, " follows"));
                    // Process follows
                    console.log("\nProcessing follows to find accounts to unfollow...");
                    return [4 /*yield*/, processFollows(agent, follows)];
                case 3:
                    processedFollows = _b.sent();
                    // Save processed follows to file
                    fs.writeFileSync(LOG_FILE, JSON.stringify(processedFollows, null, 2));
                    console.log("Saved processed follows to ".concat(LOG_FILE));
                    // Preview accounts to unfollow
                    console.log("\nAccounts that can be unfollowed:");
                    unfollowCandidates = processedFollows.filter(function (f) { return f.status !== undefined; });
                    statusCounts = {};
                    unfollowCandidates.forEach(function (f) {
                        if (f.status_label) {
                            statusCounts[f.status_label] = (statusCounts[f.status_label] || 0) + 1;
                        }
                    });
                    // Print status counts
                    Object.entries(statusCounts).forEach(function (_a) {
                        var status = _a[0], count = _a[1];
                        console.log("- ".concat(status, ": ").concat(count));
                    });
                    return [4 /*yield*/, promptUnfollowOptions(statusCounts)];
                case 4:
                    unfollowOptions = _b.sent();
                    toUnfollow = unfollowCandidates.filter(function (f) {
                        return f.status_label && unfollowOptions.includes(f.status_label);
                    });
                    if (toUnfollow.length === 0) {
                        console.log("No accounts selected for unfollowing. Exiting.");
                        process.exit(0);
                    }
                    console.log("\nSelected ".concat(toUnfollow.length, " accounts to unfollow."));
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("Do you want to proceed with unfollowing? (yes/no): ", resolve);
                        })];
                case 5:
                    confirm = _b.sent();
                    if (confirm.toLowerCase() !== "yes") {
                        console.log("Operation cancelled. Exiting.");
                        process.exit(0);
                    }
                    // Unfollow accounts
                    console.log("\nUnfollowing accounts...");
                    return [4 /*yield*/, unfollowAccounts(agent, agentDID, toUnfollow)];
                case 6:
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
// Fetch all follows
function fetchAllFollows(agent, did) {
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
                    _a.trys.push([1, 6, , 7]);
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
                    console.log("Fetched ".concat(count, " follows..."));
                    _a.label = 4;
                case 4:
                    if (cursor) return [3 /*break*/, 2];
                    _a.label = 5;
                case 5: return [2 /*return*/, follows];
                case 6:
                    error_2 = _a.sent();
                    console.error("Failed to fetch follows:", error_2);
                    return [2 /*return*/, follows]; // Return what we have so far
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Process follows to determine status
function processFollows(agent, follows) {
    return __awaiter(this, void 0, void 0, function () {
        var processedFollows, total, i, batch, promises, _a, _b, _c;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    processedFollows = [];
                    total = follows.length;
                    i = 0;
                    _d.label = 1;
                case 1:
                    if (!(i < total)) return [3 /*break*/, 5];
                    batch = follows.slice(i, i + BATCH_SIZE);
                    console.log("Processing batch ".concat(i / BATCH_SIZE + 1, "/").concat(Math.ceil(total / BATCH_SIZE), "..."));
                    promises = batch.map(function (follow) { return __awaiter(_this, void 0, void 0, function () {
                        var res, status_1, viewer, e_1, status_2, _a, _b;
                        var _c, _d, _e, _f;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _g.trys.push([0, 2, , 7]);
                                    return [4 /*yield*/, agent.getProfile({ actor: follow.did })];
                                case 1:
                                    res = _g.sent();
                                    status_1 = undefined;
                                    follow.handle = res.data.handle;
                                    viewer = res.data.viewer;
                                    if ((_c = res.data.labels) === null || _c === void 0 ? void 0 : _c.some(function (label) { return label.val === "!hide"; })) {
                                        status_1 = RepoStatus.HIDDEN;
                                    }
                                    else if (viewer === null || viewer === void 0 ? void 0 : viewer.blockedBy) {
                                        status_1 = viewer.blocking || viewer.blockingByList
                                            ? RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING
                                            : RepoStatus.BLOCKEDBY;
                                    }
                                    else if ((viewer === null || viewer === void 0 ? void 0 : viewer.blocking) || (viewer === null || viewer === void 0 ? void 0 : viewer.blockingByList)) {
                                        status_1 = RepoStatus.BLOCKING;
                                    }
                                    if (status_1 !== undefined) {
                                        follow.status = status_1;
                                        follow.status_label = getStatusLabel(status_1);
                                    }
                                    return [2 /*return*/, follow];
                                case 2:
                                    e_1 = _g.sent();
                                    if ((_d = e_1.message) === null || _d === void 0 ? void 0 : _d.includes("not found")) {
                                        status_2 = RepoStatus.DELETED;
                                    }
                                    else if ((_e = e_1.message) === null || _e === void 0 ? void 0 : _e.includes("deactivated")) {
                                        status_2 = RepoStatus.DEACTIVATED;
                                    }
                                    else if ((_f = e_1.message) === null || _f === void 0 ? void 0 : _f.includes("suspended")) {
                                        status_2 = RepoStatus.SUSPENDED;
                                    }
                                    if (!(status_2 !== undefined)) return [3 /*break*/, 6];
                                    follow.status = status_2;
                                    follow.status_label = getStatusLabel(status_2);
                                    _g.label = 3;
                                case 3:
                                    _g.trys.push([3, 5, , 6]);
                                    _a = follow;
                                    return [4 /*yield*/, resolveDid(follow.did)];
                                case 4:
                                    _a.handle = _g.sent();
                                    return [3 /*break*/, 6];
                                case 5:
                                    _b = _g.sent();
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/, follow];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    _b = (_a = processedFollows.push).apply;
                    _c = [processedFollows];
                    return [4 /*yield*/, Promise.all(promises)];
                case 2:
                    _b.apply(_a, _c.concat([_d.sent()]));
                    if (!(i + BATCH_SIZE < total)) return [3 /*break*/, 4];
                    return [4 /*yield*/, delay(BATCH_DELAY)];
                case 3:
                    _d.sent();
                    _d.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, processedFollows];
            }
        });
    });
}
// Prompt for unfollow options
function promptUnfollowOptions(statusCounts) {
    return __awaiter(this, void 0, void 0, function () {
        var options, selection, selectedIndices;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\nSelect accounts to unfollow by entering numbers separated by commas:");
                    options = Object.keys(statusCounts);
                    options.forEach(function (status, index) {
                        console.log("".concat(index + 1, ". ").concat(status, " (").concat(statusCounts[status], " accounts)"));
                    });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("\nEnter your selection (e.g., 1,3,4): ", resolve);
                        })];
                case 1:
                    selection = _a.sent();
                    selectedIndices = selection
                        .split(",")
                        .map(function (s) { return parseInt(s.trim()) - 1; })
                        .filter(function (i) { return !isNaN(i) && i >= 0 && i < options.length; });
                    return [2 /*return*/, selectedIndices.map(function (i) { return options[i]; })];
            }
        });
    });
}
// Unfollow accounts
function unfollowAccounts(agent, did, toUnfollow) {
    return __awaiter(this, void 0, void 0, function () {
        var total, unfollowed, i, batch, writes, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    total = toUnfollow.length;
                    unfollowed = 0;
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < total)) return [3 /*break*/, 8];
                    batch = toUnfollow.slice(i, i + UNFOLLOW_BATCH_SIZE);
                    writes = batch.map(function (record) {
                        // Extract rkey from URI (the last part after the slash)
                        var parts = record.uri.split('/');
                        var rkey = parts[parts.length - 1];
                        return {
                            $type: "com.atproto.repo.applyWrites#delete",
                            collection: "app.bsky.graph.follow",
                            rkey: rkey,
                        };
                    });
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, agent.com.atproto.repo.applyWrites({
                            repo: did,
                            writes: writes,
                        })];
                case 3:
                    _a.sent();
                    unfollowed += batch.length;
                    console.log("Unfollowed ".concat(unfollowed, "/").concat(total, " accounts..."));
                    return [3 /*break*/, 5];
                case 4:
                    error_3 = _a.sent();
                    console.error("Failed to unfollow batch starting at index ".concat(i, ":"), error_3);
                    return [3 /*break*/, 5];
                case 5:
                    if (!(i + UNFOLLOW_BATCH_SIZE < total)) return [3 /*break*/, 7];
                    return [4 /*yield*/, delay(UNFOLLOW_DELAY)];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    i += UNFOLLOW_BATCH_SIZE;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Helper function to get status label
function getStatusLabel(status) {
    if (status === RepoStatus.DELETED)
        return "Deleted";
    if (status === RepoStatus.DEACTIVATED)
        return "Deactivated";
    if (status === RepoStatus.SUSPENDED)
        return "Suspended";
    if (status === RepoStatus.BLOCKING)
        return "Blocking";
    if (status === RepoStatus.BLOCKEDBY)
        return "Blocked by";
    if (status === RepoStatus.HIDDEN)
        return "Hidden by moderation";
    if ((status & (RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING)) ===
        (RepoStatus.BLOCKEDBY | RepoStatus.BLOCKING))
        return "Mutual Block";
    return "Unknown";
}
// Helper function to resolve DID to handle
function resolveDid(did) {
    return __awaiter(this, void 0, void 0, function () {
        var url, response, doc, _i, _a, alias, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    url = did.startsWith("did:web")
                        ? "https://".concat(did.split(":")[2], "/.well-known/did.json")
                        : "https://plc.directory/".concat(did);
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    response = _c.sent();
                    if (!response.ok)
                        return [2 /*return*/, ""];
                    return [4 /*yield*/, response.json()];
                case 2:
                    doc = _c.sent();
                    // For web DIDs
                    if (Array.isArray(doc.alsoKnownAs)) {
                        for (_i = 0, _a = doc.alsoKnownAs; _i < _a.length; _i++) {
                            alias = _a[_i];
                            if (alias.includes("at://")) {
                                return [2 /*return*/, alias.split("//")[1]];
                            }
                        }
                    }
                    return [2 /*return*/, ""];
                case 3:
                    _b = _c.sent();
                    return [2 /*return*/, ""];
                case 4: return [2 /*return*/];
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
