import azureOpenAIService from './services/azureOpenAIService.js';

async function testAIResponse() {
  try {
    console.log('Testing AI response format...');
    
    // Test with a simple clinical note
    const testText = `Patient: Ahmad Hassan, 65-year-old male
Diagnosis: Hypertension, Type 2 Diabetes, Chronic Kidney Disease
Current Status: Patient presents with multiple chronic conditions in exacerbation phase. 
Blood pressure elevated at 165/95 mmHg. Blood glucose levels elevated. 
Patient requires assistance with most ADLs due to weakness and shortness of breath.
Safety concerns: High fall risk, oxygen usage precautions needed.
Psychiatric: Bipolar disorder with psychotic features, requires monitoring.
Wound care: Diabetic foot ulcer present, requires ongoing assessment.`;

    const response = await azureOpenAIService.analyzeDocument('test-file.txt', 'text/plain', {
      patientName: 'Ahmad Hassan',
      patientId: 'test-patient-id'
    });

    console.log('AI Response:', response);
    console.log('Response type:', typeof response);
    console.log('Response length:', response ? response.length : 0);
    
    if (response && response.analysis) {
      console.log('Analysis summary:', response.analysis.summary ? 'Present' : 'Missing');
      console.log('Analysis clinicalInsights:', response.analysis.clinicalInsights ? response.analysis.clinicalInsights.length : 0);
      console.log('Analysis soapNote:', response.analysis.soapNote ? 'Present' : 'Missing');
      console.log('Analysis oasisScores:', response.analysis.oasisScores ? Object.keys(response.analysis.oasisScores).length : 0);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testAIResponse();

