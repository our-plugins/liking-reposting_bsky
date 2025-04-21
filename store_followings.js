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
// Create CLI interface
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
// Main function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, agent, agentDID, username, accountId, newAccountId, finalAccountId, _b, followings, _c, succeeded, failed, error_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.log("=== Bluesky Followings to Database Tool ===");
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 12, , 14]);
                    // Test database connection
                    return [4 /*yield*/, testDatabaseConnection()];
                case 2:
                    // Test database connection
                    _d.sent();
                    console.log("Database connection successful!");
                    return [4 /*yield*/, login()];
                case 3:
                    _a = _d.sent(), agent = _a.agent, agentDID = _a.agentDID, username = _a.username;
                    return [4 /*yield*/, getAccountId(username)];
                case 4:
                    accountId = _d.sent();
                    if (!!accountId) return [3 /*break*/, 6];
                    console.log("Account ".concat(username, " not found in database. Adding it now..."));
                    return [4 /*yield*/, addAccountToDatabase(username)];
                case 5:
                    newAccountId = _d.sent();
                    if (!newAccountId) {
                        console.log("Failed to add account to database. Exiting.");
                        process.exit(1);
                    }
                    console.log("Added account ".concat(username, " with ID ").concat(newAccountId));
                    _d.label = 6;
                case 6:
                    _b = accountId;
                    if (_b) return [3 /*break*/, 8];
                    return [4 /*yield*/, getAccountId(username)];
                case 7:
                    _b = (_d.sent());
                    _d.label = 8;
                case 8:
                    finalAccountId = _b;
                    if (!finalAccountId) {
                        console.log("Failed to get or create account ID. Exiting.");
                        process.exit(1);
                    }
                    console.log("Using account ID: ".concat(finalAccountId, " (").concat(username, ")"));
                    // Fetch all followings
                    console.log("\nFetching all accounts you're following...");
                    return [4 /*yield*/, fetchAllFollowings(agent, agentDID)];
                case 9:
                    followings = _d.sent();
                    console.log("Found ".concat(followings.length, " accounts you're following"));
                    // Store followings in database
                    console.log("\nStoring followings in database...");
                    return [4 /*yield*/, storeFollowingsInDatabase(finalAccountId, followings)];
                case 10:
                    _c = _d.sent(), succeeded = _c.succeeded, failed = _c.failed;
                    console.log("\nOperation completed!");
                    console.log("- Successfully stored: ".concat(succeeded, " followings"));
                    console.log("- Failed to store: ".concat(failed, " followings"));
                    return [4 /*yield*/, db.end()];
                case 11:
                    _d.sent();
                    rl.close();
                    return [3 /*break*/, 14];
                case 12:
                    error_1 = _d.sent();
                    console.error("Error in main function:", error_1);
                    return [4 /*yield*/, db.end()];
                case 13:
                    _d.sent();
                    process.exit(1);
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/];
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
// Add account to database
function addAccountToDatabase(username) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db.query('INSERT INTO Accounts (username) VALUES (?)', [username])];
                case 1:
                    result = (_a.sent())[0];
                    if (result && result.insertId) {
                        return [2 /*return*/, result.insertId];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_4 = _a.sent();
                    console.error("Error adding account to database:", error_4);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Login function
function login() {
    return __awaiter(this, void 0, void 0, function () {
        var service, identifier, password, agent, response, agentDID, error_5;
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
                    error_5 = _a.sent();
                    console.error("Failed to login:", error_5);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Fetch all accounts the user is following
function fetchAllFollowings(agent, did) {
    return __awaiter(this, void 0, void 0, function () {
        var PAGE_LIMIT, cursor, followings, count, res, newFollowings, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    PAGE_LIMIT = 100;
                    cursor = undefined;
                    followings = [];
                    count = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    _a.label = 2;
                case 2: return [4 /*yield*/, agent.getFollows({ actor: did, limit: PAGE_LIMIT, cursor: cursor })];
                case 3:
                    res = _a.sent();
                    newFollowings = res.data.follows.map(function (following) {
                        return {
                            did: following.did,
                            handle: following.handle
                        };
                    });
                    followings = __spreadArray(__spreadArray([], followings, true), newFollowings, true);
                    cursor = res.data.cursor;
                    count += res.data.follows.length;
                    console.log("Fetched ".concat(count, " followings so far..."));
                    if (!cursor) return [3 /*break*/, 5];
                    return [4 /*yield*/, delay(500)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (cursor) return [3 /*break*/, 2];
                    _a.label = 6;
                case 6: return [2 /*return*/, followings];
                case 7:
                    error_6 = _a.sent();
                    console.error("Failed to fetch followings:", error_6);
                    return [2 /*return*/, followings]; // Return what we have so far
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Store followings in database
function storeFollowingsInDatabase(accountId, followings) {
    return __awaiter(this, void 0, void 0, function () {
        var succeeded, failed, now, existingRows, existingFollowings, newFollowings, BATCH_SIZE, i, batch, values, result, error_7, _i, batch_1, user, innerError_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    succeeded = 0;
                    failed = 0;
                    now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    return [4 /*yield*/, db.query('SELECT username FROM Followings WHERE account_id = ?', [accountId])];
                case 1:
                    existingRows = (_a.sent())[0];
                    existingFollowings = new Set(existingRows.map(function (row) { return row.username; }));
                    newFollowings = followings.filter(function (user) { return !existingFollowings.has(user.handle); });
                    console.log("Found ".concat(newFollowings.length, " new followings to add to database"));
                    BATCH_SIZE = 50;
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < newFollowings.length)) return [3 /*break*/, 15];
                    batch = newFollowings.slice(i, i + BATCH_SIZE);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 7, , 14]);
                    values = batch.map(function (user) { return [user.handle, now, accountId]; });
                    return [4 /*yield*/, db.query('INSERT INTO Followings (username, followed_at, account_id) VALUES ?', [values])];
                case 4:
                    result = (_a.sent())[0];
                    succeeded += result.affectedRows;
                    console.log("Stored ".concat(i + result.affectedRows, "/").concat(newFollowings.length, " followings in database"));
                    if (!(i + BATCH_SIZE < newFollowings.length)) return [3 /*break*/, 6];
                    return [4 /*yield*/, delay(200)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [3 /*break*/, 14];
                case 7:
                    error_7 = _a.sent();
                    console.error("Error inserting batch (".concat(i, "-").concat(i + batch.length, "):"));
                    _i = 0, batch_1 = batch;
                    _a.label = 8;
                case 8:
                    if (!(_i < batch_1.length)) return [3 /*break*/, 13];
                    user = batch_1[_i];
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, db.query('INSERT INTO Followings (username, followed_at, account_id) VALUES (?, ?, ?)', [user.handle, now, accountId])];
                case 10:
                    _a.sent();
                    succeeded++;
                    return [3 /*break*/, 12];
                case 11:
                    innerError_1 = _a.sent();
                    failed++;
                    return [3 /*break*/, 12];
                case 12:
                    _i++;
                    return [3 /*break*/, 8];
                case 13: return [3 /*break*/, 14];
                case 14:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 15: return [2 /*return*/, { succeeded: succeeded, failed: failed }];
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
    db.end();
    process.exit(1);
});
