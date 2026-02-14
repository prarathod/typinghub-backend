import type { NextFunction, Request, Response } from "express";

import User from "../models/User";
import { verifyToken, type JwtPayload } from "../utils/jwt";

const UNAUTHORIZED_MESSAGE = "Unauthorized";

/** Token valid only if sessionVersion in JWT matches user's current sessionVersion (one device at a time). */
function isSessionValid(payload: JwtPayload, sessionVersion: number): boolean {
  const tokenVersion = payload.v ?? 0;
  return tokenVersion === sessionVersion;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token =
    req.cookies?.auth_token ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  if (!token) {
    return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);

    if (!user || !isSessionValid(payload, user.sessionVersion ?? 0)) {
      return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token =
    req.cookies?.auth_token ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && isSessionValid(payload, user.sessionVersion ?? 0)) {
      req.user = user;
    }
  } catch {
    /* ignore invalid or expired token */
  }
  next();
};
