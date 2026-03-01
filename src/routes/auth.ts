import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { logInSchema, signUpSchema, updateSchema } from "../auth/authSchemas";

const router = Router();

const SESSION_COOKIE_NAME = "finmon_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const setSessionCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
  });
};

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const parseResult = signUpSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid payload",
        issues: parseResult.error.flatten(),
      });
    }

    const { email, password, name } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password: passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    setSessionCookie(res, token);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error("POST /auth/register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parseResult = logInSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid payload",
        issues: parseResult.error.flatten(),
      });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    setSessionCookie(res, token);

    const { password: _password, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout — clear session cookie
router.post("/logout", (_req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  });

  res.status(204).send();
});

// PUT /auth/update — update current user (protected)
router.put("/update", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = updateSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid payload",
        issues: parseResult.error.flatten(),
      });
    }

    const { email, password, name } = parseResult.data;

    if (!email && !password && name === undefined) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const userId = req.userId!;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (email) updateData.email = email;
    if (name !== undefined) updateData.name = name || null;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    setSessionCookie(res, token);
    res.json({ user, token });
  } catch (err) {
    console.error("PUT /auth/update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me — get current user (protected)
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("GET /auth/me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
