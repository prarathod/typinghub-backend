import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import mongoose from "mongoose";

import { connectMongo } from "./config/db";
import { env } from "./config/env";
import "./config/passport";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import paragraphRoutes from "./routes/paragraphs";
import paymentRoutes from "./routes/payments";

// Global error handlers - MUST be at the top before any other code
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  console.error("Unhandled Promise Rejection at:", promise, "reason:", reason);
  // Don't exit in production, just log
  if (env.NODE_ENV === "production") {
    console.error("Unhandled rejection logged, continuing...");
  }
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  // In production, we might want to exit, but log first
  console.error("Exiting due to uncaught exception");
  process.exit(1);
});

const app = express();

// Support multiple origins (for Vercel deployment)
// CLIENT_URL can be a single URL or comma-separated list
const allowedOrigins = env.CLIENT_URL.includes(",")
  ? env.CLIENT_URL.split(",").map((url) => url.trim())
  : [env.CLIENT_URL.trim()];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get("/health", async (_req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbConnected = dbStatus === 1; // 1 = connected
    
    const healthStatus = {
      status: dbConnected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbConnected ? "connected" : "disconnected",
        readyState: dbStatus, // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      },
    };

    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/paragraphs", paragraphRoutes);
app.use("/payments", paymentRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler middleware - MUST be last
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Express error handler:", err);
  res.status(500).json({
    message: "Internal server error",
    ...(env.NODE_ENV === "development" && { error: err.message, stack: err.stack })
  });
});

// MongoDB connection error handlers
mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected successfully");
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed");
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed");
        process.exit(0);
      } catch (error) {
        console.error("Error closing MongoDB connection:", error);
        process.exit(1);
      }
    });
  } else {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
      process.exit(0);
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
      process.exit(1);
    }
  }
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
let server: ReturnType<typeof app.listen> | null = null;

connectMongo()
  .then(() => {
    server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(`API running on port ${env.PORT}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${env.PORT} is already in use`);
      } else {
        console.error("Server error:", error);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
