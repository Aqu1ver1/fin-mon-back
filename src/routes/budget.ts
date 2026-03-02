import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/budget - current user's active budget
router.get(
  "/budget",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const budget = await prisma.budget.findUnique({
        where: { userId },
      });

      if (!budget) {
        res.status(404).json({ error: "Budget not found" });
        return;
      }

      res.json({ budget });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("GET /api/budget error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;

