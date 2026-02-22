import { Router } from "express";
import { getAdvice } from "../controllers/adviceController";

const router = Router();

router.post("/advice", getAdvice);

export default router;