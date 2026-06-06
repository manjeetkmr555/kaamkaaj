import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Db, UserRow } from "../db.js";
import {
  INVALID_EMAIL_MESSAGE,
  validateEmail,
  validateEmailDomainStructure,
  validateEmailFormat,
} from "../lib/emailValidation.js";
import { isEmailAllowed } from "../lib/allowedEmails.js";

const NOT_ALLOWED_MESSAGE =
  "This email is not authorized to create an account. Contact your administrator.";

function userPayload(user: Pick<UserRow, "id" | "email" | "is_admin">) {
  return {
    id: user.id,
    email: user.email,
    isAdmin: Boolean(user.is_admin),
  };
}

export function createAuthRouter(db: Db): Router {
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

    return res.json({
      valid: true,
      email: result.email,
      allowed: await isEmailAllowed(db, result.email),
    });
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

    const existing = await db.query<{ id: number }>(
      "SELECT id FROM users WHERE email = $1",
      [emailResult.email],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        field: "email",
      });
    }

    if (!(await isEmailAllowed(db, emailResult.email))) {
      return res.status(403).json({
        message: NOT_ALLOWED_MESSAGE,
        field: "email",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query<Pick<UserRow, "id" | "email" | "is_admin">>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id, email, is_admin`,
      [emailResult.email, passwordHash],
    );

    return res.status(201).json({
      message: "Account created successfully.",
      user: userPayload(rows[0]),
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

    const { rows } = await db.query<
      Pick<UserRow, "id" | "email" | "password_hash" | "is_admin">
    >(
      "SELECT id, email, password_hash, is_admin FROM users WHERE email = $1",
      [emailResult.email],
    );
    const user = rows[0];

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
      user: userPayload(user),
    });
  });

  return router;
}
