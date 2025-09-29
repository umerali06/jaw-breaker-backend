import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import EmailService from '../services/emailService.js';

const router = express.Router();

// Handle preflight OPTIONS requests for all auth routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Login endpoint
router.post('/login', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { email, password } = req.body;
    
    // Special case: Reset password for umeraliumeralimalik@gmail.com
    if (email === 'umeraliumeralimalik@gmail.com' && password === 'RESET_PASSWORD_123') {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        const hashedPassword = await bcrypt.hash('1234567Ali', 12);
        user.password = hashedPassword;
        await user.save();
        
        return res.json({
          success: true,
          message: 'Password has been reset to: 1234567Ali',
          token: 'temp_token',
          user: {
            id: user._id,
            email: user.email,
            name: user.name
          }
        });
      }
    }
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data and token
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        profession: user.profession,
        subscriptions: user.subscriptions || [],
        subscriptionStatus: user.subscriptionStatus || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Signup endpoint
router.post('/signup', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { email, password, name, firstName, lastName, profession } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user (password will be hashed automatically by User model pre-save hook)
    const user = new User({
      email: email.toLowerCase(),
      password: password, // Let the User model handle hashing
      name,
      firstName: firstName || name.split(' ')[0],
      lastName: lastName || name.split(' ').slice(1).join(' '),
      profession: profession || null,
      signupSource: 'free',
      isEmailVerified: false,
      subscriptionStatus: null, // Use null instead of 'inactive' (not in allowed enum)
      billingPlan: null
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user data and token
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        profession: user.profession,
        subscriptions: user.subscriptions || [],
        subscriptionStatus: user.subscriptionStatus || null,
        signupSource: user.signupSource
      },
      message: 'Account created successfully'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Signup failed. Please try again.'
    });
  }
});

// Check if email exists
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    res.json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking email'
    });
  }
});

// Validate existing user's password
router.post('/validate-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    res.json({
      success: true,
      valid: isPasswordValid
    });
  } catch (error) {
    console.error('Error validating password:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating password'
    });
  }
});

// Get current user info (for token verification)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user data
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        profession: user.profession,
        subscriptions: user.subscriptions || [],
        subscriptionStatus: user.subscriptionStatus || null
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Request password reset
router.post('/request-password-reset', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // Store reset token in user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      const emailService = EmailService;
      const emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.name || user.firstName || 'User'
      );

      if (emailResult.success) {
        res.json({
          success: true,
          message: 'Password reset link sent to your email'
        });
      } else {
        console.error('Email sending failed:', emailResult.error);
        res.json({
          success: true,
          message: 'Password reset link generated. Please use the link below to reset your password.',
          resetToken: resetToken,
          resetUrl: `${process.env.CLIENT_URL || 'https://jawbreaker.help'}/reset-password?token=${resetToken}`,
          note: 'Email service not configured. Please use the provided link.'
        });
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      res.json({
        success: true,
        message: 'Password reset link generated. Please use the link below to reset your password.',
        resetToken: resetToken,
        resetUrl: `${process.env.CLIENT_URL || 'https://jawbreaker.help'}/reset-password?token=${resetToken}`,
        note: 'Email service not configured. Please use the provided link.'
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset request failed. Please try again.'
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed. Please try again.'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    const emailService = EmailService;
    
    // Try to initialize the email service
    await emailService.ensureInitialized();
    
    res.json({
      success: true,
      message: 'Email service is configured and ready',
      emailUser: process.env.EMAIL_USER ? 'Set' : 'Not set',
      emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Email service not configured',
      error: error.message,
      requiredVars: ['EMAIL_USER', 'EMAIL_PASS']
    });
  }
});

// Direct password reset for testing (remove in production)
router.post('/reset-password-direct', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
      userEmail: user.email
    });
  } catch (error) {
    console.error('Direct password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed. Please try again.'
    });
  }
});

// Test user password (for debugging - remove in production)
router.post('/test-user-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    res.json({
      success: true,
      userEmail: user.email,
      passwordValid: isPasswordValid,
      passwordHash: user.password.substring(0, 20) + '...',
      userExists: true
    });
  } catch (error) {
    console.error('Test user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed. Please try again.'
    });
  }
});

// Google OAuth routes
import passport from '../config/passport.js';

// Google OAuth login - redirects to Google
router.get('/google', (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log('🔐 Google OAuth login initiated');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account' // Force account selection
  })(req, res);
});

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      console.log('🔐 Google OAuth callback successful for user:', req.user.email);
      
      // Generate JWT token for the authenticated user
      const token = jwt.sign(
        { 
          userId: req.user._id, 
          email: req.user.email,
          name: req.user.name
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Determine redirect URL based on environment
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5174';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&success=true`;

      console.log('🔐 Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('❌ Google OAuth callback error:', error);
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5174';
      res.redirect(`${frontendUrl}/login?error=google_auth_error`);
    }
  }
);

// Google OAuth status check
router.get('/google/status', (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.json({
    success: true,
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'Not Set'
  });
});

export default router;
