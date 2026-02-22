import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
// import authRouter from "./routes/auth";
import adviceRoutes from "./routes/adviceRoutes";

// Загружаем переменные окружения
dotenv.config();

// Инициализация Prisma Client
const prisma = new PrismaClient();

const app = express();

app.use(cors({
    origin: [
    "https://finance-monitoring.vercel.app",
    "https://aqu1ver1.github.io",
    "http://localhost:5173",
    "https://finance-monitoring.vercel.app"
  ]
}));
app.use(express.json());

// Роуты
// app.use("/api/auth", authRouter);
app.use("/api", adviceRoutes);

// Health-check
app.get("/health", async (req, res) => {
  try {
    // Проверка подключения к БД
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

const PORT = process.env.PORT || 4000;

// Функция для подключения к БД с повторными попытками
const connectWithRetry = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Successfully connected to database');
      return true;
    } catch (error) {
      console.log(`❌ Failed to connect to database. Attempt ${i + 1}/${retries}`);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('❌ Could not connect to database after multiple attempts');
  return false;
};

// Запуск сервера с проверкой подключения к БД
const startServer = async () => {
  const isConnected = await connectWithRetry();
  
  if (!isConnected) {
    console.error('⚠️  Starting server without database connection');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
