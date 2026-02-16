/**
 * bridge.ts — Max JavaScript bridge (compiled to dist/bridge.js)
 * Runs inside Max 9's [v8] object (NOT Node.js).
 *
 * Receives query messages from node.script via [route query],
 * executes patcher queries using this.patcher API,
 * and sends JSON responses back to node.script inlet.
 *
 * Message format in:  requestId action [extraArgs...]
 * Message format out: response JSON
 */
// --- Max JS globals ---
inlets = 1;
outlets = 1;
// --- Message handler ---
function anything() {
    const requestId = messagename;
    const args = arrayfromargs(arguments);
    const action = args[0];
    let result = null;
    switch (action) {
        case "get_objects_in_patch":
            result = getObjectsInPatch(this.patcher, false);
            break;
        case "get_objects_in_selected":
            result = getObjectsInPatch(this.patcher, true);
            break;
        case "get_object_attributes":
            result = getObjectAttributes(this.patcher, args[1]);
            break;
        case "get_avoid_rect_position":
            result = getAvoidRectPosition(this.patcher);
            break;
        default:
            post(`bridge.js: unknown action: ${action}\n`);
    }
    const json = JSON.stringify({ request_id: requestId, results: result });
    outlet(0, "response", json);
}
// --- Query implementations ---
function getObjectsInPatch(p, selectedOnly) {
    const boxes = [];
    let obj = p.firstobject;
    while (obj) {
        if (!selectedOnly || obj.selected) {
            const [left, top, right, bottom] = obj.rect;
            boxes.push({
                box: {
                    maxclass: obj.maxclass,
                    varname: obj.varname || "",
                    patching_rect: [left, top, right - left, bottom - top],
                },
            });
        }
        obj = obj.nextobject;
    }
    return { boxes, lines: [] };
}
function getObjectAttributes(p, varname) {
    const obj = p.getnamed(varname);
    if (!obj)
        return null;
    const [left, top, right, bottom] = obj.rect;
    return {
        maxclass: obj.maxclass,
        patching_rect: [left, top, right - left, bottom - top],
        varname: obj.varname || "",
    };
}
function getAvoidRectPosition(p) {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    let hasObjects = false;
    let obj = p.firstobject;
    while (obj) {
        hasObjects = true;
        const [left, top, right, bottom] = obj.rect;
        if (left < l)
            l = left;
        if (top < t)
            t = top;
        if (right > r)
            r = right;
        if (bottom > b)
            b = bottom;
        obj = obj.nextobject;
    }
    if (!hasObjects)
        return [0, 0, 0, 0];
    return [l, t, r, b];
}
