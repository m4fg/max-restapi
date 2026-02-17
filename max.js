import { createRequire } from "node:module";
import crypto from "node:crypto";
// --- max-api setup ---
export let maxApi = null;
try {
    const require = createRequire(import.meta.url);
    maxApi = require("max-api");
}
catch {
    console.log("[standalone mode] max-api not available");
}
export const log = (message) => {
    if (maxApi) {
        maxApi.post(message);
    }
    else {
        console.log(message);
    }
};
// --- Console message buffer ---
const MAX_CONSOLE_BUFFER = 1000;
const consoleBuffer = [];
let nextId = 0;
let lastReadId = -1;
const LEVEL_PRIORITY = { error: 2, warning: 1, info: 0 };

function detectLevel(message) {
    const lower = message.toLowerCase();
    if (lower.includes("error")) return "error";
    if (lower.includes("warning")) return "warning";
    return "info";
}

function pushConsoleMessage(message, level) {
    const entry = {
        id: nextId++,
        level,
        message,
        timestamp: new Date().toISOString(),
    };
    consoleBuffer.push(entry);
    if (consoleBuffer.length > MAX_CONSOLE_BUFFER) {
        consoleBuffer.shift();
    }
}

export function getConsoleMessages(level = "info", sinceLastCall = false) {
    const minPriority = LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info;
    const startId = sinceLastCall ? lastReadId : -1;

    const filtered = consoleBuffer.filter(
        (e) => e.id > startId && (LEVEL_PRIORITY[e.level] ?? 0) >= minPriority
    );

    const overflow = sinceLastCall && consoleBuffer.length > 0 && consoleBuffer[0].id > lastReadId + 1;

    if (sinceLastCall && consoleBuffer.length > 0) {
        lastReadId = consoleBuffer[consoleBuffer.length - 1].id;
    }

    return { messages: filtered, overflow };
}

// --- Request/Response correlation for queries ---
const RESPONSE_TIMEOUT_MS = 5000;
const pendingRequests = new Map();
export function queryMax(params) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error(`Request ${requestId} timed out`));
        }, RESPONSE_TIMEOUT_MS);
        pendingRequests.set(requestId, { resolve, timer });
        if (maxApi) {
            const { action, ...rest } = params;
            const extraArgs = Object.values(rest);
            maxApi.outlet("query", requestId, action, ...extraArgs);
        }
        else {
            clearTimeout(timer);
            pendingRequests.delete(requestId);
            resolve(null);
        }
        log(`[queryMax] ${requestId} ${String(params.action)}`);
    });
}
// Max からのレスポンスを受け取る
if (maxApi) {
    // console オブジェクト経由のメッセージをバッファに蓄積
    maxApi.addHandler("console_msg", (...msg) => {
        const message = msg.join(" ");
        const level = detectLevel(message);
        pushConsoleMessage(message, level);
    });
    maxApi.addHandler("response", (...msg) => {
        const str = msg.join("");
        let data;
        try {
            data = JSON.parse(str);
        }
        catch {
            log(`[response] invalid JSON: ${str}`);
            return;
        }
        if (!data?.request_id)
            return;
        const pending = pendingRequests.get(data.request_id);
        if (pending) {
            clearTimeout(pending.timer);
            pendingRequests.delete(data.request_id);
            pending.resolve(data.results);
        }
    });
}
