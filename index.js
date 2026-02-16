import express from "express";
import { log } from "./max.js";
import { router } from "./routes.js";
const app = express();
const PORT = Number(process.env.PORT) || 3009;
app.use(express.json());
app.use(router);
app.listen(PORT, () => {
    log(`Express server listening on port ${PORT}`);
});
