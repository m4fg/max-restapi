import { Router } from "express";
import { maxApi, log, queryMax } from "./max.js";
import { mockPatcher, patcherNewObject, patcherDelete, patcherConnect, patcherDisconnect, patcherSetAttribute, patcherSetText, patcherSendMessage, patcherSendBang, patcherSetNumber, } from "./patcher.js";
export const router = Router();
// --- Query endpoints ---
router.get("/", (_req, res) => {
    res.json({ status: "ok" });
});
router.get("/objects", async (_req, res) => {
    if (!maxApi) {
        res.json({ results: { boxes: mockPatcher.boxes, lines: mockPatcher.lines } });
        return;
    }
    try {
        const results = await queryMax({ action: "get_objects_in_patch" });
        res.json({ results });
    }
    catch (e) {
        res.status(504).json({ error: e.message });
    }
});
router.get("/objects/selected", async (_req, res) => {
    if (!maxApi) {
        res.json({ results: { boxes: [], lines: [] } });
        return;
    }
    try {
        const results = await queryMax({ action: "get_objects_in_selected" });
        res.json({ results });
    }
    catch (e) {
        res.status(504).json({ error: e.message });
    }
});
router.get("/objects/:varname/attributes", async (req, res) => {
    if (!maxApi) {
        const box = mockPatcher.boxes.find((b) => b.box.varname === req.params.varname);
        res.json({
            results: box ? { patching_rect: box.box.patching_rect, maxclass: box.box.maxclass } : null,
        });
        return;
    }
    try {
        const results = await queryMax({
            action: "get_object_attributes",
            varname: req.params.varname,
        });
        res.json({ results });
    }
    catch (e) {
        res.status(504).json({ error: e.message });
    }
});
router.get("/objects/bounds", async (_req, res) => {
    if (!maxApi) {
        if (mockPatcher.boxes.length === 0) {
            res.json({ results: [0, 0, 0, 0] });
            return;
        }
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const { box } of mockPatcher.boxes) {
            const rect = box.patching_rect;
            if (rect[0] !== undefined && rect[0] < l)
                l = rect[0];
            if (rect[1] !== undefined && rect[1] < t)
                t = rect[1];
            if (rect[2] !== undefined && rect[2] > r)
                r = rect[2];
            if (rect[3] !== undefined && rect[3] > b)
                b = rect[3];
        }
        res.json({ results: [l, t, r, b] });
        return;
    }
    try {
        const results = await queryMax({ action: "get_avoid_rect_position" });
        res.json({ results });
    }
    catch (e) {
        res.status(504).json({ error: e.message });
    }
});
// --- Mutation endpoints ---
router.post("/objects", (req, res) => {
    const { obj_type, position, varname, args } = req.body;
    if (!obj_type || !position || !varname) {
        res.status(400).json({ error: "missing required fields: obj_type, position, varname" });
        return;
    }
    patcherNewObject(varname, obj_type, position, args);
    log(`[add_object] ${varname} (${obj_type}) at [${String(position)}]`);
    res.json({ ok: true });
});
router.delete("/objects/:varname", (req, res) => {
    patcherDelete(req.params.varname);
    log(`[remove_object] ${req.params.varname}`);
    res.json({ ok: true });
});
router.post("/connections", (req, res) => {
    const { src_varname, dst_varname, outlet_idx, inlet_idx } = req.body;
    if (!src_varname || !dst_varname) {
        res.status(400).json({ error: "missing required fields: src_varname, dst_varname" });
        return;
    }
    patcherConnect(src_varname, outlet_idx ?? 0, dst_varname, inlet_idx ?? 0);
    log(`[connect] ${src_varname} -> ${dst_varname}`);
    res.json({ ok: true });
});
router.delete("/connections", (req, res) => {
    const { src_varname, dst_varname, outlet_idx, inlet_idx } = req.body;
    if (!src_varname || !dst_varname) {
        res.status(400).json({ error: "missing required fields: src_varname, dst_varname" });
        return;
    }
    patcherDisconnect(src_varname, outlet_idx ?? 0, dst_varname, inlet_idx ?? 0);
    log(`[disconnect] ${src_varname} x ${dst_varname}`);
    res.json({ ok: true });
});
router.patch("/objects/:varname/attributes", (req, res) => {
    const { attr_name, attr_value } = req.body;
    if (!attr_name || attr_value === undefined) {
        res.status(400).json({ error: "missing required fields: attr_name, attr_value" });
        return;
    }
    patcherSetAttribute(req.params.varname, attr_name, attr_value);
    log(`[set_attr] ${req.params.varname}.${attr_name} = ${JSON.stringify(attr_value)}`);
    res.json({ ok: true });
});
router.patch("/objects/:varname/text", (req, res) => {
    const { new_text } = req.body;
    if (new_text === undefined) {
        res.status(400).json({ error: "missing required field: new_text" });
        return;
    }
    patcherSetText(req.params.varname, new_text);
    log(`[set_text] ${req.params.varname} = "${new_text}"`);
    res.json({ ok: true });
});
router.post("/objects/:varname/message", (req, res) => {
    const { message } = req.body;
    if (message === undefined) {
        res.status(400).json({ error: "missing required field: message" });
        return;
    }
    patcherSendMessage(req.params.varname, message);
    log(`[send_message] ${req.params.varname} <- ${message}`);
    res.json({ ok: true });
});
router.post("/objects/:varname/bang", (req, res) => {
    patcherSendBang(req.params.varname);
    log(`[bang] ${req.params.varname}`);
    res.json({ ok: true });
});
router.patch("/objects/:varname/number", (req, res) => {
    const { num } = req.body;
    if (num === undefined) {
        res.status(400).json({ error: "missing required field: num" });
        return;
    }
    patcherSetNumber(req.params.varname, num);
    log(`[set_number] ${req.params.varname} = ${num}`);
    res.json({ ok: true });
});
