import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 Testing Azure OpenAI Configuration');
console.log('=====================================\n');

// Get configuration
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const version = process.env.AZURE_OPENAI_API_VERSION;

console.log('Configuration:');
console.log('  Endpoint:', endpoint);
console.log('  API Key:', apiKey ? 'Present (' + apiKey.substring(0, 10) + '...)' : 'Missing');
console.log('  Deployment:', deployment);
console.log('  Version:', version);
console.log('');

if (!endpoint || !apiKey || !deployment || !version) {
  console.log('❌ Missing required configuration');
  process.exit(1);
}

// Test different deployment names
const possibleDeployments = [
  'gpt-4o',
  'gpt-4',
  'gpt-35-turbo',
  'gpt-4o-mini',
  'gpt-5-chat' // Your current deployment name
];

async function testDeployment(deploymentName) {
  try {
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${version}`;
    console.log(`Testing deployment: ${deploymentName}`);
    console.log(`URL: ${url}`);
    
    const response = await axios.post(url, {
      messages: [
        { role: 'user', content: 'Hello, this is a test message.' }
      ],
      max_tokens: 10,
      temperature: 0.1
    }, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ ${deploymentName}: SUCCESS`);
    console.log(`   Response: ${response.data.choices[0].message.content}`);
    return true;
  } catch (error) {
    console.log(`❌ ${deploymentName}: FAILED`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error?.message || 'Unknown error'}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testAllDeployments() {
  console.log('Testing all possible deployment names...\n');
  
  for (const deploymentName of possibleDeployments) {
    const success = await testDeployment(deploymentName);
    if (success) {
      console.log(`\n🎉 Found working deployment: ${deploymentName}`);
      console.log(`\nTo fix your configuration, update your .env file:`);
      console.log(`AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}`);
      break;
    }
    console.log('');
  }
}

// Run the test
testAllDeployments().catch(console.error);
