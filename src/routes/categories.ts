import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/categories - default + user-specific categories
router.get(
  "/categories",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const categories = await prisma.category.findMany({
        orderBy: { id: "asc" },
      });

      res.json({ categories });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("GET /api/categories error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;

