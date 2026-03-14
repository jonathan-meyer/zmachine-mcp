import cors from "cors";
import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import mcpServer from "./mcp-server.js";
import restServer from "./rest-server.js";
import { SessionManager } from "./session-manager.js";
import wsServer from "./ws-server.js";

const app = express();

const STORIES_FOLDER = process.env.STORIES ?? "/";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const sessionManager = new SessionManager(STORIES_FOLDER);

app.use(cors());
app.use(express.json());
app.use(restServer(sessionManager));
app.use(mcpServer(sessionManager));

const server = ViteExpress.listen(app, PORT, () =>
  console.log(`Server is listening on port ${PORT}...`),
);

wsServer(server, PORT, sessionManager);
