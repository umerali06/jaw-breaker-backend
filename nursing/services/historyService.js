import AnalysisHistory from '../models/AnalysisHistory.js';

class HistoryService {
  /**
   * Save analysis result to database
   */
  async saveAnalysisResult(patientId, patientName, analysisType, analysisData, inputData, userId) {
    try {
      const historyEntry = new AnalysisHistory({
        patientId,
        patientName,
        analysisType,
        analysisData,
        inputData,
        userId
      });

      const savedEntry = await historyEntry.save();
      return {
        success: true,
        data: savedEntry
      };
    } catch (error) {
      console.error('Error saving analysis result:', error);
      return {
        success: false,
        error: 'Failed to save analysis result'
      };
    }
  }

  /**
   * Get patient's analysis history
   */
  async getPatientHistory(patientId, analysisType = null, userId = null) {
    try {
      const history = await AnalysisHistory.getPatientHistory(patientId, analysisType, userId);
      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('Error fetching patient history:', error);
      return {
        success: false,
        error: 'Failed to fetch patient history'
      };
    }
  }

  /**
   * Get user's analysis history
   */
  async getUserHistory(userId, limit = 100) {
    try {
      const history = await AnalysisHistory.getUserHistory(userId, limit);
      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error('Error fetching user history:', error);
      return {
        success: false,
        error: 'Failed to fetch user history'
      };
    }
  }

  /**
   * Delete specific analysis entry
   */
  async deleteAnalysisEntry(entryId, userId) {
    try {
      const entry = await AnalysisHistory.findOne({ 
        _id: entryId, 
        userId, 
        isDeleted: false 
      });

      if (!entry) {
        return {
          success: false,
          error: 'Analysis entry not found'
        };
      }

      await entry.softDelete();
      return {
        success: true,
        message: 'Analysis entry deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting analysis entry:', error);
      return {
        success: false,
        error: 'Failed to delete analysis entry'
      };
    }
  }

  /**
   * Clear all patient history
   */
  async clearPatientHistory(patientId, userId = null) {
    try {
      await AnalysisHistory.clearPatientHistory(patientId, userId);
      return {
        success: true,
        message: 'Patient history cleared successfully'
      };
    } catch (error) {
      console.error('Error clearing patient history:', error);
      return {
        success: false,
        error: 'Failed to clear patient history'
      };
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(userId) {
    try {
      const stats = await AnalysisHistory.aggregate([
        { $match: { userId, isDeleted: false } },
        {
          $group: {
            _id: '$analysisType',
            count: { $sum: 1 },
            latestDate: { $max: '$timestamp' }
          }
        }
      ]);

      const totalEntries = await AnalysisHistory.countDocuments({ 
        userId, 
        isDeleted: false 
      });

      const uniquePatients = await AnalysisHistory.distinct('patientId', { 
        userId, 
        isDeleted: false 
      });

      return {
        success: true,
        data: {
          totalEntries,
          uniquePatients: uniquePatients.length,
          byType: stats.reduce((acc, stat) => {
            acc[stat._id] = {
              count: stat.count,
              latestDate: stat.latestDate
            };
            return acc;
          }, {})
        }
      };
    } catch (error) {
      console.error('Error fetching analysis stats:', error);
      return {
        success: false,
        error: 'Failed to fetch analysis statistics'
      };
    }
  }
}

export default new HistoryService();
