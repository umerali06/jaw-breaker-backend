import VoiceTranscriptionHistory from '../models/VoiceTranscriptionHistory.js';
import { v4 as uuidv4 } from 'uuid';

class VoiceTranscriptionHistoryService {
  /**
   * Save a new voice transcription to history
   */
  async saveTranscription(transcriptionData, userId, patientId = null) {
    try {
      console.log('VoiceTranscriptionHistoryService.saveTranscription called with:', { 
        userId, 
        patientId, 
        sessionId: transcriptionData.sessionId 
      });

      const {
        sessionId,
        audioFileName,
        audioSize,
        audioDuration,
        transcriptionText,
        structuredDocumentation,
        processingTime,
        confidence,
        language = 'en',
        tags = [],
        notes = ''
      } = transcriptionData;

      // Generate session ID if not provided
      const finalSessionId = sessionId || uuidv4();

      const newTranscription = new VoiceTranscriptionHistory({
        userId,
        patientId,
        sessionId: finalSessionId,
        audioFileName,
        audioSize,
        audioDuration,
        transcriptionText,
        structuredDocumentation,
        processingTime,
        confidence,
        language,
        tags,
        notes
      });

      const savedTranscription = await newTranscription.save();
      console.log('✅ Voice transcription saved to history:', savedTranscription._id);

      return {
        success: true,
        data: savedTranscription
      };

    } catch (error) {
      console.error('❌ Error saving voice transcription to history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's voice transcription history
   */
  async getUserTranscriptions(userId, options = {}) {
    try {
      console.log('VoiceTranscriptionHistoryService.getUserTranscriptions called with:', { userId, options });

      const transcriptions = await VoiceTranscriptionHistory.getUserTranscriptions(userId, options);
      console.log('📋 Found transcriptions:', transcriptions.length);

      return {
        success: true,
        data: transcriptions
      };

    } catch (error) {
      console.error('❌ Error getting user transcriptions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get a specific transcription by session ID
   */
  async getTranscriptionBySessionId(sessionId) {
    try {
      console.log('VoiceTranscriptionHistoryService.getTranscriptionBySessionId called with:', { sessionId });

      const transcription = await VoiceTranscriptionHistory.getBySessionId(sessionId);
      
      if (!transcription) {
        return {
          success: false,
          error: 'Transcription not found'
        };
      }

      return {
        success: true,
        data: transcription
      };

    } catch (error) {
      console.error('❌ Error getting transcription by session ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a transcription
   */
  async updateTranscription(transcriptionId, updateData, userId) {
    try {
      console.log('VoiceTranscriptionHistoryService.updateTranscription called with:', { 
        transcriptionId, 
        userId, 
        updateData 
      });

      const transcription = await VoiceTranscriptionHistory.findOne({
        _id: transcriptionId,
        userId,
        isDeleted: false
      });

      if (!transcription) {
        return {
          success: false,
          error: 'Transcription not found or access denied'
        };
      }

      // Update allowed fields
      const allowedFields = [
        'transcriptionText',
        'structuredDocumentation',
        'tags',
        'notes',
        'confidence'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          transcription[field] = updateData[field];
        }
      });

      transcription.updatedAt = new Date();
      const updatedTranscription = await transcription.save();

      console.log('✅ Voice transcription updated:', updatedTranscription._id);

      return {
        success: true,
        data: updatedTranscription
      };

    } catch (error) {
      console.error('❌ Error updating voice transcription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Archive a transcription
   */
  async archiveTranscription(transcriptionId, userId) {
    try {
      console.log('VoiceTranscriptionHistoryService.archiveTranscription called with:', { 
        transcriptionId, 
        userId 
      });

      const transcription = await VoiceTranscriptionHistory.findOne({
        _id: transcriptionId,
        userId,
        isDeleted: false
      });

      if (!transcription) {
        return {
          success: false,
          error: 'Transcription not found or access denied'
        };
      }

      await transcription.archive();
      console.log('✅ Voice transcription archived:', transcriptionId);

      return {
        success: true,
        message: 'Transcription archived successfully'
      };

    } catch (error) {
      console.error('❌ Error archiving voice transcription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a transcription (soft delete)
   */
  async deleteTranscription(transcriptionId, userId) {
    try {
      console.log('VoiceTranscriptionHistoryService.deleteTranscription called with:', { 
        transcriptionId, 
        userId 
      });

      const transcription = await VoiceTranscriptionHistory.findOne({
        _id: transcriptionId,
        userId,
        isDeleted: false
      });

      if (!transcription) {
        return {
          success: false,
          error: 'Transcription not found or access denied'
        };
      }

      await transcription.softDelete();
      console.log('✅ Voice transcription deleted:', transcriptionId);

      return {
        success: true,
        message: 'Transcription deleted successfully'
      };

    } catch (error) {
      console.error('❌ Error deleting voice transcription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore a deleted transcription
   */
  async restoreTranscription(transcriptionId, userId) {
    try {
      console.log('VoiceTranscriptionHistoryService.restoreTranscription called with:', { 
        transcriptionId, 
        userId 
      });

      const transcription = await VoiceTranscriptionHistory.findOne({
        _id: transcriptionId,
        userId,
        isDeleted: true
      });

      if (!transcription) {
        return {
          success: false,
          error: 'Deleted transcription not found or access denied'
        };
      }

      await transcription.restore();
      console.log('✅ Voice transcription restored:', transcriptionId);

      return {
        success: true,
        message: 'Transcription restored successfully'
      };

    } catch (error) {
      console.error('❌ Error restoring voice transcription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user's transcription statistics
   */
  async getUserStats(userId, patientId = null, options = {}) {
    try {
      console.log('VoiceTranscriptionHistoryService.getUserStats called with:', { userId, patientId, options });

      // Normalize empty strings - handle undefined, null, empty string, and "null" string cases
      const safePatientId = patientId && 
                           patientId !== 'null' && 
                           String(patientId).trim() !== '' && 
                           String(patientId).trim() !== 'null' ? 
                           String(patientId).trim() : null;

      // Wire includeArchived through to the model (default false)
      const includeArchived = options.includeArchived === true;

      const stats = await VoiceTranscriptionHistory.getUserStats(
        userId,
        safePatientId,
        { includeArchived }
      );

      const result = stats[0] || {
        totalTranscriptions: 0,
        totalDuration: 0,
        totalSize: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        lastTranscription: null
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('❌ Error getting user transcription stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search transcriptions by text content
   */
  async searchTranscriptions(userId, searchQuery, options = {}) {
    try {
      console.log('VoiceTranscriptionHistoryService.searchTranscriptions called with:', { 
        userId, 
        searchQuery, 
        options 
      });

      const {
        patientId = null,
        limit = 20,
        skip = 0
      } = options;

      const query = {
        userId,
        isDeleted: false,
        $or: [
          { transcriptionText: { $regex: searchQuery, $options: 'i' } },
          { notes: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ]
      };

      if (patientId) {
        query.patientId = patientId;
      }

      const transcriptions = await VoiceTranscriptionHistory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('-__v');

      console.log('🔍 Found transcriptions matching search:', transcriptions.length);

      return {
        success: true,
        data: transcriptions
      };

    } catch (error) {
      console.error('❌ Error searching transcriptions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new VoiceTranscriptionHistoryService();
