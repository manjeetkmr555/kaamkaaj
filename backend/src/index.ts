import "dotenv/config";
import cors from "cors";
import express from "express";
import { initDb } from "./db.js";
import { createAdminRouter } from "./routes/admin.js";
import { createAuthRouter } from "./routes/auth.js";
import { createWorkRouter } from "./routes/work.js";
import { createSharesRouter } from "./routes/shares.js";
import { createReadingRouter } from "./routes/reading.js";
import { createReadingSharesRouter } from "./routes/readingShares.js";

const PORT = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = new Set(
  (isProduction
    ? (process.env.FRONTEND_ORIGIN ?? "")
    : (process.env.FRONTEND_ORIGIN ??
      "http://localhost:3000,http://localhost:3002"))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

async function main() {
  const db = await initDb();
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (
          allowedOrigins.has(origin) ||
          (!isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin))
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
      health: "/health",
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/admin", createAdminRouter(db));
  app.use("/api/work", createWorkRouter(db));
  app.use("/api/work", createSharesRouter(db));
  app.use("/api/reading", createReadingRouter(db));
  app.use("/api/reading", createReadingSharesRouter(db));

  app.listen(PORT, () => {
    console.log(`KaamKaaj API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
