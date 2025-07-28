import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password required only if not using Google OAuth
      },
      minlength: [8, "Password must be at least 8 characters long"],
      validate: {
        validator: function (password) {
          // Only validate if password is provided (for Google OAuth users)
          if (!password && this.googleId) return true;
          return password && password.length >= 8;
        },
        message: "Password must be at least 8 characters long",
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    avatar: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ resetPasswordToken: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash password if it's modified and exists
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // No password set (Google OAuth user)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get public user data
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    avatar: this.avatar,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find user by Google ID
userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId });
};

// Validation for unique email with better error message
userSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    if (error.keyPattern.email) {
      next(new Error("Email address is already registered"));
    } else if (error.keyPattern.googleId) {
      next(new Error("Google account is already linked to another user"));
    } else {
      next(error);
    }
  } else {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);

export default User;
