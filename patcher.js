import { maxApi } from "./max.js";
export const mockPatcher = {
    boxes: [],
    lines: [],
};
// --- Patcher operations via thispatcher script messages ---
export function patcherNewObject(varname, type, position, args) {
    const argTokens = args ? args.split(" ") : [];
    if (maxApi) {
        maxApi.outlet("script", "new", varname, type, ...argTokens);
        maxApi.outlet("script", "sendbox", varname, "patching_rect", position[0], position[1], position[0] + 80, position[1] + 22);
        if (type === "message" || type === "comment" || type === "flonum") {
            maxApi.outlet("script", "send", varname, "set", ...argTokens);
        }
    }
    else {
        mockPatcher.boxes.push({
            box: {
                maxclass: type,
                varname,
                patching_rect: [position[0], position[1], position[0] + 80, position[1] + 22],
            },
        });
    }
}
export function patcherDelete(varname) {
    if (maxApi) {
        maxApi.outlet("script", "delete", varname);
    }
    else {
        mockPatcher.boxes = mockPatcher.boxes.filter((b) => b.box.varname !== varname);
        mockPatcher.lines = mockPatcher.lines.filter((l) => l.patchline.source[0] !== varname && l.patchline.destination[0] !== varname);
    }
}
export function patcherConnect(src, outIdx, dst, inIdx) {
    if (maxApi) {
        maxApi.outlet("script", "connect", src, outIdx, dst, inIdx);
    }
    else {
        mockPatcher.lines.push({ patchline: { source: [src, outIdx], destination: [dst, inIdx] } });
    }
}
export function patcherDisconnect(src, outIdx, dst, inIdx) {
    if (maxApi) {
        maxApi.outlet("script", "disconnect", src, outIdx, dst, inIdx);
    }
    else {
        mockPatcher.lines = mockPatcher.lines.filter((l) => !(l.patchline.source[0] === src &&
            l.patchline.source[1] === outIdx &&
            l.patchline.destination[0] === dst &&
            l.patchline.destination[1] === inIdx));
    }
}
export function patcherSetAttribute(varname, attr, value) {
    if (maxApi) {
        maxApi.outlet("script", "sendbox", varname, attr, value);
    }
}
export function patcherSetText(varname, text) {
    if (maxApi) {
        maxApi.outlet("script", "send", varname, "set", text);
    }
}
export function patcherSendMessage(varname, message) {
    if (maxApi) {
        maxApi.outlet("script", "send", varname, message);
    }
}
export function patcherSendBang(varname) {
    if (maxApi) {
        maxApi.outlet("script", "send", varname, "bang");
    }
}
export function patcherSetNumber(varname, num) {
    if (maxApi) {
        maxApi.outlet("script", "send", varname, "set", num);
    }
}
