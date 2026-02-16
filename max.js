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
        log(`[query] ${requestId} ${String(params.action)}`);
    });
}
// Max からのレスポンスを受け取る
if (maxApi) {
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
