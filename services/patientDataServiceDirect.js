import mongoose from 'mongoose';
import File from '../models/File.js';

class PatientDataServiceDirect {
  /**
   * Get patient documents using direct collection access to bypass Patient model timeout
   */
  static async getPatientDocuments(patientId, userId) {
    try {
      console.log(`🔍 Getting documents for patient ${patientId} and user ${userId}`);
      
      // Get the current connection
      const connection = mongoose.connection;
      console.log('🔍 Service connection debug:');
      console.log('  connection:', typeof connection);
      console.log('  connection.db:', typeof connection.db);
      console.log('  connection.readyState:', connection.readyState);
      
      if (!connection || !connection.db) {
        throw new Error('MongoDB connection not ready');
      }
      
      // Use direct collection access instead of Patient model
      const patientsCollection = connection.db.collection('patients');
      
      // Find patient directly
      const patient = await patientsCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(patientId) 
      });
      
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }
      
      console.log(`✅ Found patient: ${patient.name}`);
      console.log(`📄 Patient has ${patient.documents ? patient.documents.length : 0} documents`);
      
      // Get documents from files collection
      if (!patient.documents || patient.documents.length === 0) {
        console.log('ℹ️ No documents found for patient');
        return [];
      }
      
      const documentsFromArray = await File.find({
        _id: { $in: patient.documents },
        $or: [
          { userId: userId },
          { userId: userId.toString() },
        ],
      })
      .select('filename originalname createdAt processingStatus extractedText contentLength mimetype size')
      .sort({ createdAt: -1 });
      
      console.log(`✅ Retrieved ${documentsFromArray.length} documents from File model`);
      
      // Also try direct collection access for files if File model has issues
      let documentsFromDirect = [];
      try {
        const filesCollection = connection.db.collection('files');
        documentsFromDirect = await filesCollection.find({
          _id: { $in: patient.documents.map(id => new mongoose.Types.ObjectId(id)) },
          $or: [
            { userId: userId },
            { userId: userId.toString() },
          ],
        })
        .project({
          filename: 1,
          originalname: 1,
          createdAt: 1,
          processingStatus: 1,
          extractedText: 1,
          contentLength: 1,
          mimetype: 1,
          size: 1
        })
        .sort({ createdAt: -1 })
        .toArray();
        
        console.log(`✅ Retrieved ${documentsFromDirect.length} documents from direct collection access`);
      } catch (directError) {
        console.log(`⚠️ Direct collection access failed: ${directError.message}`);
      }
      
      // Use whichever method worked better
      const documents = documentsFromArray.length > 0 ? documentsFromArray : documentsFromDirect;
      
      // Remove duplicates and ensure we have the required fields
      const uniqueDocuments = documents.filter((doc, index, self) => 
        index === self.findIndex(d => d._id.toString() === doc._id.toString())
      );
      
      console.log(`📊 Final document count: ${uniqueDocuments.length}`);
      
      // Log content length for debugging
      uniqueDocuments.forEach((doc, index) => {
        const contentLength = doc.contentLength || (doc.extractedText ? doc.extractedText.length : 0);
        console.log(`Document ${index + 1}: ${doc.filename} - Content length: ${contentLength} characters`);
      });
      
      return uniqueDocuments;
      
    } catch (error) {
      console.error(`❌ Error in getPatientDocuments: ${error.message}`);
      throw new Error(`Failed to get patient documents: ${error.message}`);
    }
  }
  
  /**
   * Get patient basic info using direct collection access
   */
  static async getPatientInfo(patientId) {
    try {
      // Get the current connection
      const connection = mongoose.connection;
      console.log('🔍 Service getPatientInfo connection debug:');
      console.log('  connection:', typeof connection);
      console.log('  connection.db:', typeof connection.db);
      console.log('  connection.readyState:', connection.readyState);
      
      if (!connection || !connection.db) {
        throw new Error('MongoDB connection not ready');
      }
      
      const patientsCollection = connection.db.collection('patients');
      const patient = await patientsCollection.findOne({ 
        _id: new mongoose.Types.ObjectId(patientId) 
      });
      
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`);
      }
      
      return {
        id: patient._id,
        name: patient.name,
        userId: patient.userId,
        documents: patient.documents || [],
        isActive: patient.isActive
      };
      
    } catch (error) {
      console.error(`❌ Error in getPatientInfo: ${error.message}`);
      throw new Error(`Failed to get patient info: ${error.message}`);
    }
  }
}

export default PatientDataServiceDirect;
