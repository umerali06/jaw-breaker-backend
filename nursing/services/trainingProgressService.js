import TrainingProgress from '../models/TrainingProgress.js';
import TrainingModule from '../models/TrainingModule.js';

class TrainingProgressService {
  // Enroll user in training
  async enrollInTraining(userId, trainingId, patientId = null) {
    try {
      // Check if already enrolled
      const existingProgress = await TrainingProgress.findOne({
        userId: userId,
        trainingId: trainingId
      });

      if (existingProgress) {
        return {
          success: true,
          data: existingProgress,
          message: 'Already enrolled in this training'
        };
      }

      // Create new enrollment
      const progress = new TrainingProgress({
        userId: userId,
        trainingId: trainingId,
        patientId: patientId,
        status: 'enrolled'
      });

      await progress.save();

      // Update training module enrollment count
      await TrainingModule.findByIdAndUpdate(
        trainingId,
        { $inc: { enrollmentCount: 1 } }
      );

      return {
        success: true,
        data: progress,
        message: 'Successfully enrolled in training'
      };
    } catch (error) {
      console.error('Error enrolling in training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user's training progress
  async getTrainingProgress(userId, trainingId) {
    try {
      const progress = await TrainingProgress.findOne({
        userId: userId,
        trainingId: trainingId
      }).populate('trainingId', 'title category estimatedDuration');

      if (!progress) {
        return {
          success: false,
          error: 'Training progress not found'
        };
      }

      return {
        success: true,
        data: progress
      };
    } catch (error) {
      console.error('Error getting training progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all user's training progress
  async getUserTrainingProgress(userId, status = null) {
    try {
      const query = { userId: userId };
      if (status) {
        query.status = status;
      }

      const progress = await TrainingProgress.find(query)
        .populate('trainingId', 'title category estimatedDuration difficulty')
        .sort({ lastAccessedAt: -1 });

      return {
        success: true,
        data: progress
      };
    } catch (error) {
      console.error('Error getting user training progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update training progress
  async updateProgress(userId, trainingId, moduleIndex, totalModules) {
    try {
      const progress = await TrainingProgress.findOne({
        userId: userId,
        trainingId: trainingId
      });

      if (!progress) {
        return {
          success: false,
          error: 'Training progress not found'
        };
      }

      await progress.updateProgress(moduleIndex, totalModules);

      return {
        success: true,
        data: progress
      };
    } catch (error) {
      console.error('Error updating training progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Complete training
  async completeTraining(userId, trainingId, completionData) {
    try {
      const progress = await TrainingProgress.findOne({
        userId: userId,
        trainingId: trainingId
      });

      if (!progress) {
        return {
          success: false,
          error: 'Training progress not found'
        };
      }

      await progress.completeTraining(
        completionData.score,
        completionData.timeSpent,
        completionData.answers
      );

      // Update training module completion count and average score
      const training = await TrainingModule.findById(trainingId);
      if (training) {
        const newCompletionCount = (training.completionCount || 0) + 1;
        const newAverageScore = training.averageScore 
          ? (training.averageScore + completionData.score) / 2 
          : completionData.score;

        await TrainingModule.findByIdAndUpdate(trainingId, {
          completionCount: newCompletionCount,
          averageScore: newAverageScore
        });
      }

      return {
        success: true,
        data: progress,
        message: 'Training completed successfully'
      };
    } catch (error) {
      console.error('Error completing training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get training statistics
  async getTrainingStats(userId) {
    try {
      const stats = await TrainingProgress.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            averageScore: { $avg: '$score' },
            totalTimeSpent: { $sum: '$timeSpent' }
          }
        }
      ]);

      const totalEnrolled = await TrainingProgress.countDocuments({ userId: userId });
      const completed = await TrainingProgress.countDocuments({ 
        userId: userId, 
        status: 'completed' 
      });
      const inProgress = await TrainingProgress.countDocuments({ 
        userId: userId, 
        status: 'in_progress' 
      });

      return {
        success: true,
        data: {
          totalEnrolled,
          completed,
          inProgress,
          completionRate: totalEnrolled > 0 ? (completed / totalEnrolled) * 100 : 0,
          stats: stats
        }
      };
    } catch (error) {
      console.error('Error getting training stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Submit training feedback
  async submitFeedback(userId, trainingId, feedback) {
    try {
      const progress = await TrainingProgress.findOne({
        userId: userId,
        trainingId: trainingId
      });

      if (!progress) {
        return {
          success: false,
          error: 'Training progress not found'
        };
      }

      progress.feedback = {
        ...feedback,
        submittedAt: new Date()
      };

      await progress.save();

      return {
        success: true,
        data: progress,
        message: 'Feedback submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TrainingProgressService();
