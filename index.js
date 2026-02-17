import express from "express";
import { log } from "./max.js";
import { router } from "./routes.js";
export const app = express();
const PORT = Number(process.env.PORT) || 3009;
app.use(express.json());
app.use(router);
export let server;
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
const isMax = process.argv[1] && process.argv[1].includes("Max.app");
if (isDirectRun || isMax) {
    server = app.listen(PORT, () => {
        log(`Express server listening on port ${PORT}`);
    });
}
