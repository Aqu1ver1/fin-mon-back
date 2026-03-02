import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/transactions - all transactions for current user
router.get(
  "/transactions",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: "desc" },
      });

      res.json({ transactions });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("GET /api/transactions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;

