import express from "express";
import cors from "cors";
import adviceRoutes from "./routes/adviceRoutes";
import authRoutes from "./routes/auth";
import { prisma } from "./lib/prisma";

const app = express();

app.use(cors({
  origin: [
    "https://finance-monitoring.vercel.app",
    "https://aqu1ver1.github.io",
    "http://localhost:5173",
  ]
}));
app.use(express.json());
app.use('/auth', authRoutes);
app.use("/api", adviceRoutes);

// Health-check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      message: "Server is running!",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      message: "Server is running",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default app;
