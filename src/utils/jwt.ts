import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { UserDocument } from "../models/User";

export const signToken = (user: UserDocument) => {
  return jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    expiresIn: "7d"
  });
};
