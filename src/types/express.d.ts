import type { UserDocument } from "../models/User";

declare global {
  namespace Express {
    interface User extends UserDocument {}

    interface Request {
      user?: UserDocument;
    }
  }
}

export {};
