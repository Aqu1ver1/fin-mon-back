import { Router } from "express";
import { getAdvice } from "../controllers/adviceController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/advice", authMiddleware, getAdvice);

export default router;