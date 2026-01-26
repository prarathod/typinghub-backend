import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";

import { connectMongo } from "./config/db";
import { env } from "./config/env";
import "./config/passport";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import paragraphRoutes from "./routes/paragraphs";
import paymentRoutes from "./routes/payments";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/admin", adminRoutes);
app.use("/auth", authRoutes);
app.use("/paragraphs", paragraphRoutes);
app.use("/payments", paymentRoutes);

connectMongo()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`API running on port ${env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
