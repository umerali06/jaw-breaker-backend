#!/usr/bin/env node

/**
 * Payment System Setup Script
 * Helps set up the payment system without requiring Stripe CLI
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Payment System Setup Script');
console.log('===============================\n');

function createEnvFile() {
  const envContent = `# Payment System Environment Configuration
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000

# Database
MONGO_URI=mongodb://127.0.0.1:27017/jawbreaker
MONGODB_URI=mongodb://127.0.0.1:27017/jawbreaker

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_SECRET_KEY=your_jwt_secret_here
JWT_EXPIRES_IN=1d

# Stripe Configuration (REPLACE WITH YOUR ACTUAL KEYS)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Feature Flags
FEATURE_AI_ENABLED=true
FEATURE_AUDIT_ENABLED=true
FEATURE_HEALTHCHECKS_ENABLED=true
FEATURE_STUDENT_ENABLED=true

# AI Providers
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=https://heidi-mf24i2i1-eastus2.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-chat
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper

# Fallback AI Providers
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=your_gemini_api_key
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Student Module
NEXT_PUBLIC_API_URL=http://localhost:5000

# Other Services
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_NODE=http://localhost:9200
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file template');
    console.log('⚠️  IMPORTANT: Edit .env file with your actual Stripe keys');
    return true;
  } catch (error) {
    console.log('❌ Failed to create .env file:', error.message);
    return false;
  }
}

function checkDependencies() {
  console.log('🔍 Checking dependencies...');
  
  const packageJsonPath = './package.json';
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = ['stripe', 'express', 'mongoose', 'cors'];
    const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);
    
    if (missingDeps.length === 0) {
      console.log('✅ All required dependencies are installed');
      return true;
    } else {
      console.log('❌ Missing dependencies:', missingDeps.join(', '));
      console.log('Run: npm install', missingDeps.join(' '));
      return false;
    }
  } else {
    console.log('❌ package.json not found');
    return false;
  }
}

function createTestScripts() {
  console.log('🔧 Creating test scripts...');
  
  const testScripts = {
    'test:payment': 'node tests/quick-test.js',
    'test:webhook': 'node tests/mock-webhook-test.js',
    'test:comprehensive': 'node tests/stripe-payment-test.js'
  };

  try {
    const packageJsonPath = './package.json';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      Object.assign(packageJson.scripts, testScripts);
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Added test scripts to package.json');
      return true;
    }
  } catch (error) {
    console.log('❌ Failed to update package.json:', error.message);
    return false;
  }
}

function displayInstructions() {
  console.log('\n📋 SETUP INSTRUCTIONS');
  console.log('=====================\n');
  
  console.log('1. 🔑 Get Your Stripe Keys:');
  console.log('   - Go to https://dashboard.stripe.com');
  console.log('   - Switch to Test mode');
  console.log('   - Go to Developers → API keys');
  console.log('   - Copy your Publishable key (pk_test_...)');
  console.log('   - Copy your Secret key (sk_test_...)');
  console.log('   - Enable "Raw card data APIs" in Settings → API keys');
  
  console.log('\n2. 📝 Update Environment Variables:');
  console.log('   - Edit the .env file created above');
  console.log('   - Replace the placeholder values with your actual keys');
  console.log('   - For webhook secret, use: whsec_test_mock_secret_for_testing');
  
  console.log('\n3. 🧪 Run Tests:');
  console.log('   - npm run test:payment    # Quick payment test');
  console.log('   - npm run test:webhook    # Webhook test');
  console.log('   - npm run test:comprehensive # Full test suite');
  
  console.log('\n4. 🚀 Start Your Application:');
  console.log('   - npm start');
  console.log('   - Test payment flow in your application');
  
  console.log('\n5. 🔍 Monitor Results:');
  console.log('   - Check console logs for test results');
  console.log('   - Verify payment processing works');
  console.log('   - Test error scenarios');
}

async function main() {
  console.log('Starting payment system setup...\n');
  
  const results = {
    envFile: createEnvFile(),
    dependencies: checkDependencies(),
    testScripts: createTestScripts()
  };
  
  console.log('\n📊 SETUP RESULTS');
  console.log('================');
  console.log(`Environment File: ${results.envFile ? '✅ Created' : '❌ Failed'}`);
  console.log(`Dependencies: ${results.dependencies ? '✅ Ready' : '❌ Missing'}`);
  console.log(`Test Scripts: ${results.testScripts ? '✅ Added' : '❌ Failed'}`);
  
  if (results.envFile && results.dependencies && results.testScripts) {
    console.log('\n🎉 Setup completed successfully!');
    displayInstructions();
  } else {
    console.log('\n⚠️ Setup completed with some issues. Please check the errors above.');
    displayInstructions();
  }
}

main().catch(console.error);
