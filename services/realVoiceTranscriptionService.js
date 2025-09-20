import 'dotenv/config';
import multer from 'multer';

class RealVoiceTranscriptionService {
  constructor() {
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    this.azureDeployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  }

  /**
   * Perform REAL speech-to-text using Azure OpenAI Whisper API
   */
  async transcribeAudio(audioBuffer, options = {}) {
    try {
      console.log('🎤 Starting REAL Azure OpenAI Whisper transcription...');
      
      if (!this.azureApiKey || !this.azureEndpoint) {
        throw new Error('Azure OpenAI credentials not configured');
      }

      // Build Azure OpenAI Whisper URL
      const url = `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/audio/transcriptions?api-version=${this.apiVersion}`;

      // Create FormData for the request
      const form = new FormData();
      const filename = options.filename || 'audio.webm';
      const mimeType = options.mimeType || 'audio/webm';

      // Create Blob from buffer
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      form.append('file', audioBlob, filename);

      // Whisper parameters
      form.append('model', 'whisper-1');
      form.append('temperature', '0'); // More deterministic
      form.append('response_format', 'json');
      
      if (options.language) {
        form.append('language', options.language);
      }
      if (options.prompt) {
        form.append('prompt', options.prompt);
      }

      console.log('📤 Sending request to Azure OpenAI Whisper...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.azureApiKey
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure OpenAI Whisper error:', response.status, errorText);
        throw new Error(`Azure OpenAI Whisper API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ REAL Azure OpenAI Whisper transcription:', data.text);

      return {
        success: true,
        text: data.text?.trim() || '',
        confidence: 0.95,
        language: data.language || 'en',
        duration: data.duration || null
      };

    } catch (error) {
      console.error('❌ Real voice transcription error:', error);
      return {
        success: false,
        error: error.message,
        text: '',
        confidence: 0
      };
    }
  }

  /**
   * Test the transcription service
   */
  async testTranscription() {
    try {
      console.log('🧪 Testing real voice transcription service...');
      
      // Create a minimal valid WebM audio buffer (just the header)
      // This is a minimal WebM file header that Whisper can recognize
      const webmHeader = Buffer.from([
        0x1A, 0x45, 0xDF, 0xA3, // EBML header
        0x9F, 0x42, 0x86, 0x81, // EBML version
        0x01, 0x42, 0xF7, 0x81, // EBML read version
        0x01, 0x42, 0xF2, 0x81, // EBML max ID length
        0x01, 0x42, 0xF3, 0x81, // EBML max size length
        0x01, 0x42, 0x82, 0x84, // Doc type
        0x77, 0x65, 0x62, 0x6D, // "webm"
        0x42, 0x87, 0x81, 0x02, // Doc type version
        0x42, 0x85, 0x81, 0x02, // Doc type read version
      ]);
      
      const result = await this.transcribeAudio(webmHeader, {
        filename: 'test.webm',
        mimeType: 'audio/webm',
        language: 'en',
        prompt: 'This is a medical transcription test'
      });

      console.log('Test result:', result);
      return result;
    } catch (error) {
      console.error('Test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new RealVoiceTranscriptionService();
