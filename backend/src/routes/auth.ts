import { Router } from "express";
import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import {
  INVALID_EMAIL_MESSAGE,
  validateEmail,
  validateEmailDomainStructure,
  validateEmailFormat,
} from "../lib/emailValidation.js";
import type { UserRow } from "../db.js";

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/validate-email", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const result = await validateEmail(email, { checkDns: true });

    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        message: INVALID_EMAIL_MESSAGE,
        reason: result.reason,
      });
    }

    return res.json({ valid: true, email: result.email });
  });

  router.post("/register", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    const emailResult = await validateEmail(email, { checkDns: true });
    if (!emailResult.valid) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
        field: "password",
      });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(emailResult.email) as { id: number } | undefined;

    if (existing) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        field: "email",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const insert = db.prepare(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    );
    const info = insert.run(emailResult.email, passwordHash);

    return res.status(201).json({
      message: "Account created successfully.",
      user: { id: Number(info.lastInsertRowid), email: emailResult.email },
    });
  });

  router.post("/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    const normalized = email.trim().toLowerCase();

    if (!validateEmailFormat(normalized)) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    if (!validateEmailDomainStructure(normalized)) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    const emailResult = await validateEmail(email, { checkDns: true });
    if (!emailResult.valid) {
      return res.status(400).json({
        message: INVALID_EMAIL_MESSAGE,
        field: "email",
      });
    }

    const user = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(emailResult.email) as Pick<UserRow, "id" | "email" | "password_hash"> | undefined;

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
        field: "credentials",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        message: "Invalid email or password.",
        field: "credentials",
      });
    }

    return res.json({
      message: "Login successful.",
      user: { id: user.id, email: user.email },
    });
  });

  return router;
}
