import mongoose from 'mongoose';

const userFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  guidelineId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['clinical-guideline', 'patient', 'document'],
    default: 'clinical-guideline'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can only favorite a guideline once
userFavoriteSchema.index({ userId: 1, guidelineId: 1 }, { unique: true });

const UserFavorite = mongoose.model('UserFavorite', userFavoriteSchema);

export default UserFavorite;











