import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import app from "./app";

dotenv.config();

// Validate required environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}
if (JWT_SECRET === 'your-secret-key-change-in-production-min-32-chars-long') {
  console.warn('WARNING: Using default JWT_SECRET. Change it before deploying to production.');
}

const PORT = process.env.PORT || 4000;

const connectWithRetry = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('Successfully connected to database');
      return true;
    } catch (error) {
      console.log(`Failed to connect to database. Attempt ${i + 1}/${retries}`);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Could not connect to database after multiple attempts');
  return false;
};

const startServer = async () => {
  const isConnected = await connectWithRetry();

  if (!isConnected) {
    console.error('Starting server without database connection');
  }

  app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  });
};

startServer();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
