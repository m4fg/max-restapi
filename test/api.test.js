import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { app } from "../index.js";
import { mockPatcher } from "../patcher.js";

let server;
let baseUrl;

beforeEach(async () => {
    mockPatcher.boxes = [];
    mockPatcher.lines = [];
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const { port } = server.address();
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
});

// --- Health check ---
describe("GET /", () => {
    it("returns status ok", async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body, { status: "ok" });
    });
});

// --- Console ---
describe("GET /console", () => {
    it("returns empty messages in standalone mode", async () => {
        const res = await fetch(`${baseUrl}/console`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body, { messages: [], overflow: false });
    });

    it("accepts level query parameter", async () => {
        const res = await fetch(`${baseUrl}/console?level=error`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body, { messages: [], overflow: false });
    });

    it("accepts since_last_call query parameter", async () => {
        const res = await fetch(`${baseUrl}/console?since_last_call=true`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body.messages));
    });
});

// --- Objects CRUD ---
describe("GET /objects", () => {
    it("returns empty boxes and lines", async () => {
        const res = await fetch(`${baseUrl}/objects`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body, { results: { boxes: [], lines: [] } });
    });
});

describe("POST /objects", () => {
    it("creates an object and GET /objects returns it", async () => {
        const postRes = await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "toggle", position: [100, 200], varname: "t1" }),
        });
        assert.equal(postRes.status, 200);
        assert.deepEqual(await postRes.json(), { ok: true });

        const getRes = await fetch(`${baseUrl}/objects`);
        const body = await getRes.json();
        assert.equal(body.results.boxes.length, 1);
        assert.equal(body.results.boxes[0].box.varname, "t1");
        assert.equal(body.results.boxes[0].box.maxclass, "toggle");
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "toggle" }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error.includes("missing"));
    });
});

describe("DELETE /objects/:varname", () => {
    it("deletes an object", async () => {
        await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "button", position: [0, 0], varname: "b1" }),
        });

        const delRes = await fetch(`${baseUrl}/objects/b1`, { method: "DELETE" });
        assert.equal(delRes.status, 200);
        assert.deepEqual(await delRes.json(), { ok: true });

        const getRes = await fetch(`${baseUrl}/objects`);
        const body = await getRes.json();
        assert.equal(body.results.boxes.length, 0);
    });
});

// --- Connections ---
describe("POST /connections", () => {
    it("creates a connection", async () => {
        const res = await fetch(`${baseUrl}/connections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src_varname: "a", dst_varname: "b", outlet_idx: 0, inlet_idx: 0 }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });

        const getRes = await fetch(`${baseUrl}/objects`);
        const body = await getRes.json();
        assert.equal(body.results.lines.length, 1);
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await fetch(`${baseUrl}/connections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src_varname: "a" }),
        });
        assert.equal(res.status, 400);
    });
});

describe("DELETE /connections", () => {
    it("removes a connection", async () => {
        await fetch(`${baseUrl}/connections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src_varname: "a", dst_varname: "b", outlet_idx: 0, inlet_idx: 0 }),
        });

        const delRes = await fetch(`${baseUrl}/connections`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src_varname: "a", dst_varname: "b", outlet_idx: 0, inlet_idx: 0 }),
        });
        assert.equal(delRes.status, 200);
        assert.deepEqual(await delRes.json(), { ok: true });

        const getRes = await fetch(`${baseUrl}/objects`);
        const body = await getRes.json();
        assert.equal(body.results.lines.length, 0);
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await fetch(`${baseUrl}/connections`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
    });
});

// --- Object attributes ---
describe("GET /objects/:varname/attributes", () => {
    it("returns attributes for an existing object", async () => {
        await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "slider", position: [10, 20], varname: "s1" }),
        });

        const res = await fetch(`${baseUrl}/objects/s1/attributes`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.results);
        assert.equal(body.results.maxclass, "slider");
        assert.deepEqual(body.results.patching_rect, [10, 20, 90, 42]);
    });

    it("returns null for non-existent object", async () => {
        const res = await fetch(`${baseUrl}/objects/nope/attributes`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.results, null);
    });
});

// --- Bounds ---
describe("GET /objects/bounds", () => {
    it("returns [0,0,0,0] when no objects", async () => {
        const res = await fetch(`${baseUrl}/objects/bounds`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body.results, [0, 0, 0, 0]);
    });

    it("returns bounding box of objects", async () => {
        await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "toggle", position: [50, 100], varname: "x1" }),
        });
        await fetch(`${baseUrl}/objects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obj_type: "button", position: [200, 300], varname: "x2" }),
        });

        const res = await fetch(`${baseUrl}/objects/bounds`);
        const body = await res.json();
        assert.equal(body.results[0], 50);   // left
        assert.equal(body.results[1], 100);  // top
        assert.equal(body.results[2], 280);  // right  (200+80)
        assert.equal(body.results[3], 322);  // bottom (300+22)
    });
});

// --- Attribute mutation ---
describe("PATCH /objects/:varname/attributes", () => {
    it("returns ok", async () => {
        const res = await fetch(`${baseUrl}/objects/obj1/attributes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attr_name: "bgcolor", attr_value: [1, 0, 0, 1] }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await fetch(`${baseUrl}/objects/obj1/attributes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attr_name: "bgcolor" }),
        });
        assert.equal(res.status, 400);
    });
});

// --- Text ---
describe("PATCH /objects/:varname/text", () => {
    it("sets text", async () => {
        const res = await fetch(`${baseUrl}/objects/msg1/text`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_text: "hello world" }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
    });

    it("returns 400 when new_text is missing", async () => {
        const res = await fetch(`${baseUrl}/objects/msg1/text`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
    });
});

// --- Message ---
describe("POST /objects/:varname/message", () => {
    it("sends a message", async () => {
        const res = await fetch(`${baseUrl}/objects/obj1/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "bang" }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
    });

    it("returns 400 when message is missing", async () => {
        const res = await fetch(`${baseUrl}/objects/obj1/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
    });
});

// --- Bang ---
describe("POST /objects/:varname/bang", () => {
    it("sends a bang", async () => {
        const res = await fetch(`${baseUrl}/objects/obj1/bang`, { method: "POST" });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
    });
});

// --- Number ---
describe("PATCH /objects/:varname/number", () => {
    it("sets a number", async () => {
        const res = await fetch(`${baseUrl}/objects/num1/number`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ num: 42 }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true });
    });

    it("returns 400 when num is missing", async () => {
        const res = await fetch(`${baseUrl}/objects/num1/number`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        assert.equal(res.status, 400);
    });
});
