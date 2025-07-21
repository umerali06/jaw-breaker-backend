import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AuthService from "../services/authService.js";

// Function to initialize passport configuration
export const initializePassport = () => {
  // Get environment variables (they should be loaded by now)
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;

  // Debug logging
  console.log("=== Passport Configuration Debug ===");
  console.log("CLIENT_ID exists:", !!clientID);
  console.log("CLIENT_SECRET exists:", !!clientSecret);
  console.log("CALLBACK_URL:", callbackURL);

  // Validate required environment variables
  if (!clientID) {
    console.error(
      "FATAL ERROR: GOOGLE_CLIENT_ID environment variable is missing"
    );
    console.error("Make sure your .env file contains GOOGLE_CLIENT_ID");
    throw new Error(
      "GOOGLE_CLIENT_ID is required for Google OAuth configuration"
    );
  }

  if (!clientSecret) {
    console.error(
      "FATAL ERROR: GOOGLE_CLIENT_SECRET environment variable is missing"
    );
    console.error("Make sure your .env file contains GOOGLE_CLIENT_SECRET");
    throw new Error(
      "GOOGLE_CLIENT_SECRET is required for Google OAuth configuration"
    );
  }

  if (!callbackURL) {
    console.error(
      "FATAL ERROR: GOOGLE_CALLBACK_URL environment variable is missing"
    );
    console.error("Make sure your .env file contains GOOGLE_CALLBACK_URL");
    throw new Error(
      "GOOGLE_CALLBACK_URL is required for Google OAuth configuration"
    );
  }

  console.log("✅ All Google OAuth environment variables are present");

  // Configure Google OAuth strategy
  try {
    passport.use(
      new GoogleStrategy(
        {
          clientID: clientID,
          clientSecret: clientSecret,
          callbackURL: callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            console.log("Google OAuth callback received for user:", profile.id);

            // Find or create user using AuthService
            const result = await AuthService.findOrCreateGoogleUser(profile);

            if (result.success) {
              console.log(
                "Google OAuth user authenticated successfully:",
                result.user.email
              );
              return done(null, result.user);
            } else {
              console.error(
                "Google OAuth user authentication failed:",
                result.error
              );
              return done(new Error(result.error), null);
            }
          } catch (error) {
            console.error("Google OAuth callback error:", error);
            return done(error, null);
          }
        }
      )
    );

    console.log("✅ Google OAuth strategy configured successfully");
  } catch (error) {
    console.error("❌ Failed to configure Google OAuth strategy:", error);
    throw error;
  }

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const User = (await import("../models/User.js")).default;
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  return passport;
};

export default passport;
