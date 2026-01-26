import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { env } from "./env";
import User from "../models/User";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? "";
        const avatarUrl = profile.photos?.[0]?.value;

        const user = await User.findOneAndUpdate(
          { googleId: profile.id },
          {
            googleId: profile.id,
            email,
            name: profile.displayName || email,
            avatarUrl
          },
          { upsert: true, new: true }
        );

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);
