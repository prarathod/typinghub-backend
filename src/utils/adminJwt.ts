import jwt from "jsonwebtoken";

import { env } from "../config/env";

export type AdminJwtPayload = {
  role: "admin";
  username: string;
};

export const signAdminToken = (username: string): string => {
  return jwt.sign(
    { role: "admin", username },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

export const verifyAdminToken = (token: string): AdminJwtPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
  if (payload.role !== "admin") {
    throw new Error("Invalid admin token");
  }
  return payload;
};
