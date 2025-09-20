#!/usr/bin/env node

/**
 * Azure OpenAI Configuration Helper
 * This script helps you configure Azure OpenAI environment variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Azure OpenAI Configuration Helper');
console.log('=====================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found. Creating from template...\n');
  
  if (fs.existsSync(envExamplePath)) {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    fs.writeFileSync(envPath, envExample);
    console.log('✅ Created .env file from env.example template\n');
  } else {
    console.log('❌ env.example file not found. Please create a .env file manually.\n');
    process.exit(1);
  }
}

// Read current .env file
const envContent = fs.readFileSync(envPath, 'utf8');

console.log('📋 Current Azure OpenAI Configuration:');
console.log('=====================================');

// Check each required variable
const requiredVars = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
  'AZURE_OPENAI_API_VERSION'
];

let missingVars = [];
let configuredVars = [];

requiredVars.forEach(varName => {
  const regex = new RegExp(`^${varName}=(.+)$`, 'm');
  const match = envContent.match(regex);
  
  if (match && match[1] && !match[1].includes('your_') && !match[1].includes('replace_')) {
    console.log(`✅ ${varName}: ${match[1].substring(0, 20)}...`);
    configuredVars.push(varName);
  } else {
    console.log(`❌ ${varName}: Not configured or using placeholder`);
    missingVars.push(varName);
  }
});

console.log('\n📝 Configuration Instructions:');
console.log('==============================');

if (missingVars.length > 0) {
  console.log('\n🔧 To configure Azure OpenAI, follow these steps:\n');
  
  console.log('1. Go to Azure Portal (https://portal.azure.com)');
  console.log('2. Navigate to your Azure OpenAI resource');
  console.log('3. Go to "Keys and Endpoint" section');
  console.log('4. Copy the endpoint URL and API key\n');
  
  console.log('5. Update your .env file with the following values:\n');
  
  missingVars.forEach(varName => {
    switch (varName) {
      case 'AZURE_OPENAI_API_KEY':
        console.log('   AZURE_OPENAI_API_KEY=your_actual_api_key_here');
        break;
      case 'AZURE_OPENAI_ENDPOINT':
        console.log('   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com');
        break;
      case 'AZURE_OPENAI_DEPLOYMENT_NAME':
        console.log('   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o');
        break;
      case 'AZURE_OPENAI_API_VERSION':
        console.log('   AZURE_OPENAI_API_VERSION=2024-02-15-preview');
        break;
    }
  });
  
  console.log('\n6. Restart your server after updating the .env file\n');
} else {
  console.log('\n✅ All Azure OpenAI variables are configured!');
  console.log('🚀 Your AI service should be working properly.\n');
}

console.log('🔍 Example Azure OpenAI Resource Setup:');
console.log('=======================================');
console.log('1. Create Azure OpenAI resource in Azure Portal');
console.log('2. Deploy a model (e.g., GPT-4, GPT-4o)');
console.log('3. Get endpoint URL: https://your-resource-name.openai.azure.com');
console.log('4. Get API key from "Keys and Endpoint" section');
console.log('5. Update .env file with actual values');
console.log('6. Restart server\n');

console.log('📞 Need help? Check the Azure OpenAI documentation:');
console.log('https://learn.microsoft.com/en-us/azure/cognitive-services/openai/');
