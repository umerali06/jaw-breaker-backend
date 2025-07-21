import express from "express";
import passport from "../config/passport.js";
import {
  signup,
  login,
  logout,
  getCurrentUser,
  googleAuthSuccess,
  googleAuthFailure,
} from "../controllers/authController.js";
import {
  authenticateToken,
  validateAuthInput,
  handleAuthError,
} from "../middleware/auth.js";

const router = express.Router();

// Signup endpoint
router.post(
  "/signup",
  validateAuthInput(["email", "password", "name"]),
  signup
);

// Login endpoint
router.post("/login", validateAuthInput(["email", "password"]), login);

// Logout endpoint
router.post("/logout", logout);

// Get current user (protected route)
router.get("/me", authenticateToken, getCurrentUser);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/google/failure",
    session: false,
  }),
  googleAuthSuccess
);

router.get("/google/failure", googleAuthFailure);

// Error handling middleware
router.use(handleAuthError);

export default router;
