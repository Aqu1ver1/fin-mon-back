import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

const migrationBudgetSchema = z
  .object({
    amount: z.number(),
    scheme: z.string(),
    createDate: z.string(),
  })
  .nullable();

const migrationCategorySchema = z.object({
  id: z.number(),
  type: z.string(),
  category: z.string(),
  iconUrl: z.string(),
  budgetType: z.union([z.enum(["needs", "wants", "savings"]), z.literal("")]).optional(),
});

const migrationTransactionSchema = z.object({
  id: z.number(),
  amount: z.number(),
  type: z.union([z.literal(1), z.literal(-1)]),
  id_category: z.number(),
  description: z.string().optional(),
  date: z.union([z.string(), z.date()]),
});

const migrationPayloadSchema = z.object({
  budget: migrationBudgetSchema,
  categories: z.array(migrationCategorySchema),
  transactions: z.array(migrationTransactionSchema),
});

// POST /migration/import
router.post(
  "/import",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parseResult = migrationPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid migration payload",
        issues: parseResult.error.flatten(),
      });
      return;
    }

    const { budget, categories, transactions } = parseResult.data;

    try {
      const operations = [];

      if (budget && budget.amount > 0 && budget.scheme.trim() !== "") {
        const createdAt = new Date(budget.createDate);
        operations.push(
          prisma.budget.upsert({
            where: { userId },
            update: {
              amount: budget.amount,
              scheme: budget.scheme,
              createdAt,
              isActive: true,
            },
            create: {
              userId,
              amount: budget.amount,
              scheme: budget.scheme,
              createdAt,
              isActive: true,
            },
          }),
        );
      }

      for (const category of categories) {
        const normalizedBudgetType = category.budgetType && category.budgetType.length > 0 ? category.budgetType : null;

        operations.push(
          prisma.category.upsert({
            where: { id: category.id },
            update: {
              type: category.type,
              name: category.category,
              iconUrl: category.iconUrl,
              budgetType: normalizedBudgetType,
              isDefault: false,
            },
            create: {
              id: category.id,
              type: category.type,
              name: category.category,
              iconUrl: category.iconUrl,
              budgetType: normalizedBudgetType,
              isDefault: false,
            },
          }),
        );
      }

      if (transactions.length > 0) {
        const data = transactions.map((txItem) => ({
          userId,
          amount: txItem.amount,
          type: txItem.type,
          categoryId: txItem.id_category,
          description: txItem.description ?? null,
          date: new Date(txItem.date as string),
        }));

        operations.push(
          prisma.transaction.createMany({
            data,
            skipDuplicates: true,
          }),
        );
      }

      if (operations.length > 0) {
        await prisma.$transaction(operations);
      }

      res.status(204).send();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("POST /migration/import error:", error);
      res.status(500).json({ error: "Failed to import migration data" });
    }
  },
);

export default router;

