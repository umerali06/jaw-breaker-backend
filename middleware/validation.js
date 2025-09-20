/**
 * Middleware to validate patient data
 */
export const validatePatientData = (req, res, next) => {
  try {
    const { patientId, clinicalData, medications, labResults, notes } = req.body;
    
    // Basic validation
    if (!patientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Patient ID is required' 
      });
    }
    
    // Additional validation can be added here based on specific requirements
    console.log('Patient data validation passed', { patientId });
    next();
  } catch (error) {
    console.error('Patient data validation error:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Invalid patient data format' 
    });
  }
};

/**
 * Middleware to validate clinical input data
 */
export const validateClinicalInput = (req, res, next) => {
  try {
    const { symptoms, clinicalFindings, patientHistory, diagnosticData } = req.body;
    
    // Basic validation
    if (!symptoms && !clinicalFindings && !patientHistory && !diagnosticData) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one clinical input field is required' 
      });
    }
    
    // Additional validation can be added here based on specific requirements
    console.log('Clinical input validation passed');
    next();
  } catch (error) {
    console.error('Clinical input validation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Invalid clinical input format' 
    });
  }
};
