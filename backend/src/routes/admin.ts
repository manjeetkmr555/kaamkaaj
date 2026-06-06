import { Router } from "express";
import type { Db } from "../db.js";
import {
  addAllowedEmail,
  isEmailAllowed,
  listAllowedEmails,
  removeAllowedEmail,
} from "../lib/allowedEmails.js";
import { isAdminUser } from "../lib/admin.js";
import {
  INVALID_EMAIL_MESSAGE,
  validateEmail,
} from "../lib/emailValidation.js";

function parseUserId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

async function requireAdmin(
  db: Db,
  userId: number | null,
): Promise<string | null> {
  if (!userId || !(await isAdminUser(db, userId))) {
    return "Admin access required.";
  }
  return null;
}

export function createAdminRouter(db: Db): Router {
  const router = Router();

  router.get("/allowed-emails", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    const denied = await requireAdmin(db, userId);
    if (denied) {
      return res.status(403).json({ message: denied });
    }

    const emails = (await listAllowedEmails(db)).map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
    }));

    return res.json({ emails });
  });

  router.post("/allowed-emails", async (req, res) => {
    const userId = parseUserId(req.body?.userId);
    const denied = await requireAdmin(db, userId);
    if (denied) {
      return res.status(403).json({ message: denied });
    }

    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const emailResult = await validateEmail(email, { checkDns: true });
    if (!emailResult.valid) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    if (await isEmailAllowed(db, emailResult.email)) {
      return res.status(409).json({
        message: "This email is already on the allowlist.",
        field: "email",
      });
    }

    const row = await addAllowedEmail(db, emailResult.email);
    return res.status(201).json({
      email: { id: row.id, email: row.email, createdAt: row.created_at },
    });
  });

  router.delete("/allowed-emails/:id", async (req, res) => {
    const userId = parseUserId(req.query.userId);
    const denied = await requireAdmin(db, userId);
    if (denied) {
      return res.status(403).json({ message: denied });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid email id." });
    }

    const removed = await removeAllowedEmail(db, id);
    if (!removed) {
      return res.status(404).json({ message: "Email not found." });
    }

    return res.json({ message: "Email removed from allowlist." });
  });

  return router;
}
