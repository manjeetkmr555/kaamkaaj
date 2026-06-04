import cors from "cors";
import express from "express";
import { initDb } from "./db.js";
import { createAuthRouter } from "./routes/auth.js";
import { createWorkRouter } from "./routes/work.js";
import { createSharesRouter } from "./routes/shares.js";
import { createReadingRouter } from "./routes/reading.js";
import { createReadingSharesRouter } from "./routes/readingShares.js";

const PORT = Number(process.env.PORT ?? 4000);

const db = initDb();
const app = express();

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000,http://localhost:3002")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        allowedOrigins.has(origin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "KaamKaaj API",
    status: "running",
    message:
      "This is the backend API. Open the app in your browser at http://localhost:3000 (or the port shown by npm run dev in frontend/).",
    health: "/health",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", createAuthRouter(db));
app.use("/api/work", createWorkRouter(db));
app.use("/api/work", createSharesRouter(db));
app.use("/api/reading", createReadingRouter(db));
app.use("/api/reading", createReadingSharesRouter(db));

app.listen(PORT, () => {
  console.log(`KaamKaaj API listening on http://localhost:${PORT}`);
});
