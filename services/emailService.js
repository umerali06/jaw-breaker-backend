import nodemailer from "nodemailer";

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Lazy initialization - only initialize when first used
  ensureInitialized() {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeTransporter();
    }
    return this.initializationPromise;
  }

  /**
   * Initialize email transporter based on environment
   */
  async initializeTransporter() {
    // Debug environment variables
    console.log("🔍 Email Environment Variables Debug:");
    console.log(
      "EMAIL_USER:",
      process.env.EMAIL_USER ? "✅ Set" : "❌ Not set"
    );
    console.log(
      "EMAIL_PASS:",
      process.env.EMAIL_PASS ? "✅ Set" : "❌ Not set"
    );
    console.log("EMAIL_HOST:", process.env.EMAIL_HOST || "Not set");
    console.log("NODE_ENV:", process.env.NODE_ENV);

    // Force real email configuration - no test accounts
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        "❌ REAL EMAIL REQUIRED: EMAIL_USER and EMAIL_PASS must be set in .env file"
      );
      console.error(
        "❌ Current EMAIL_USER:",
        process.env.EMAIL_USER || "NOT SET"
      );
      console.error(
        "❌ Current EMAIL_PASS:",
        process.env.EMAIL_PASS ? "SET" : "NOT SET"
      );
      throw new Error("Real email configuration required");
    }

    console.log("📧 Real email configuration found, setting up SMTP...");

    const emailConfig = {
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    try {
      this.transporter = nodemailer.createTransport(emailConfig);
      this.isInitialized = true;
      console.log("✅ Email service initialized successfully with REAL email:");
      console.log(`   📧 Host: ${emailConfig.host}:${emailConfig.port}`);
      console.log(`   👤 User: ${emailConfig.auth.user}`);
      console.log(`   🔒 Secure: ${emailConfig.secure}`);
    } catch (error) {
      console.error("❌ Failed to initialize email service:", error);
      // Fallback to test account
      await this.createTestAccount();
    }
  }

  /**
   * Create test account for development
   */
  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.isInitialized = true;
      console.log("✅ Test email account created for development");
      console.log("Test account user:", testAccount.user);
    } catch (error) {
      console.error("❌ Failed to create test email account:", error);
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} userName - User's name
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(email, resetToken, userName = "User") {
    // Ensure initialization is complete
    await this.ensureInitialized();

    if (!this.transporter) {
      console.error("Email service not initialized");
      return {
        success: false,
        error: "Email service not available",
      };
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5174";
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: {
        name: "Jawbreaker Support",
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      },
      to: email,
      subject: "Reset Your Password - Jawbreaker",
      html: this.generatePasswordResetHTML(userName, resetUrl),
      text: this.generatePasswordResetText(userName, resetUrl),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      // Log preview URL for development
      if (process.env.NODE_ENV === "development") {
        console.log("Password reset email sent!");
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl:
          process.env.NODE_ENV === "development"
            ? nodemailer.getTestMessageUrl(info)
            : null,
      };
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      return {
        success: false,
        error: "Failed to send email",
      };
    }
  }

  /**
   * Generate HTML email template for password reset
   * @param {string} userName - User's name
   * @param {string} resetUrl - Password reset URL
   * @returns {string} HTML email content
   */
  generatePasswordResetHTML(userName, resetUrl) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background-color: white;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                border-radius: 12px;
                margin: 0 auto 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                color: white;
                text-decoration: none;
                padding: 12px 30px;
                border-radius: 6px;
                font-weight: 500;
                margin: 20px 0;
                text-align: center;
            }
            .button:hover {
                opacity: 0.9;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
            .warning {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 15px;
                margin: 20px 0;
                color: #92400e;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">J</div>
                <h1>Reset Your Password</h1>
            </div>
            
            <p>Hi ${userName},</p>
            
            <p>We received a request to reset your password for your Jawbreaker account. If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
            
            <div class="warning">
                <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you need to reset your password after that, please request a new reset link.
            </div>
            
            <div class="footer">
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
                <p>This email was sent by Jawbreaker. If you have any questions, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate plain text email for password reset
   * @param {string} userName - User's name
   * @param {string} resetUrl - Password reset URL
   * @returns {string} Plain text email content
   */
  generatePasswordResetText(userName, resetUrl) {
    return `
Hi ${userName},

We received a request to reset your password for your Jawbreaker account. If you didn't make this request, you can safely ignore this email.

To reset your password, visit this link:
${resetUrl}

SECURITY NOTICE: This link will expire in 1 hour for your security. If you need to reset your password after that, please request a new reset link.

If you're having trouble accessing the link, copy and paste it into your web browser.

This email was sent by Jawbreaker. If you have any questions, please contact our support team.

Best regards,
The Jawbreaker Team
    `;
  }

  /**
   * Verify email service connection
   * @returns {Promise<boolean>} Connection status
   */
  async verifyConnection() {
    // Ensure initialization is complete
    await this.ensureInitialized();

    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Email service connection failed:", error);
      return false;
    }
  }

  /**
   * Test email sending functionality
   * @param {string} email - Test email address
   * @returns {Promise<Object>} Test result
   */
  async testEmailSending(email = "test@example.com") {
    await this.ensureInitialized();

    if (!this.transporter) {
      return {
        success: false,
        error: "Email service not initialized",
      };
    }

    const testMailOptions = {
      from: {
        name: "Jawbreaker Test",
        address:
          process.env.EMAIL_FROM ||
          process.env.EMAIL_USER ||
          "test@ethereal.email",
      },
      to: email,
      subject: "Test Email - Jawbreaker",
      html: "<h1>Test Email</h1><p>This is a test email from Jawbreaker.</p>",
      text: "Test Email\n\nThis is a test email from Jawbreaker.",
    };

    try {
      const info = await this.transporter.sendMail(testMailOptions);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl:
          process.env.NODE_ENV === "development"
            ? nodemailer.getTestMessageUrl(info)
            : null,
      };
    } catch (error) {
      console.error("Test email failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export default new EmailService();
