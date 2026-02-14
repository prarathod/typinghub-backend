import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { UserDocument } from "../models/User";

/** JWT payload: sub = user id, v = session version (for single-device enforcement). */
export type JwtPayload = {
  sub: string;
  v?: number;
};

export const JWT_EXPIRY = "7d";

export function signToken(user: UserDocument): string {
  return jwt.sign(
    { sub: user._id.toString(), v: user.sessionVersion },
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
