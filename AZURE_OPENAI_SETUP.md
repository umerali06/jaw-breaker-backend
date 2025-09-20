# Azure OpenAI Setup Guide

## Quick Setup Instructions

### 1. Create Azure OpenAI Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Azure OpenAI" and select it
4. Fill in the required details:
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or use existing
   - **Region**: Choose a region (e.g., East US, West US 2)
   - **Name**: Choose a unique name (e.g., `your-company-openai`)
   - **Pricing Tier**: Choose based on your needs

### 2. Deploy a Model

1. After creating the resource, go to "Model deployments"
2. Click "Create new deployment"
3. Select a model:
   - **GPT-4o** (recommended for best performance)
   - **GPT-4** (good alternative)
   - **GPT-3.5-turbo** (cost-effective option)
4. Give it a deployment name (e.g., `gpt-4o`)
5. Click "Create"

### 3. Get API Credentials

1. Go to "Keys and Endpoint" in your Azure OpenAI resource
2. Copy the following:
   - **Endpoint**: `https://your-resource-name.openai.azure.com`
   - **API Key**: Copy either Key1 or Key2

### 4. Configure Environment Variables

Create or update your `.env` file in the server directory with:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_actual_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 5. Test the Configuration

Run the configuration checker:
```bash
cd server
node configure-azure-openai.js
```

### 6. Restart the Server

After updating the `.env` file, restart your server:
```bash
npm start
```

## Troubleshooting

### Common Issues

1. **"Invalid URL" Error**
   - Check that your endpoint URL includes `https://` and ends with `.openai.azure.com`
   - Ensure there are no extra spaces or characters

2. **"Authentication Failed" Error**
   - Verify your API key is correct
   - Check that the API key has the right permissions

3. **"Model Not Found" Error**
   - Ensure the deployment name matches exactly
   - Check that the model is deployed and active

4. **"Rate Limit Exceeded" Error**
   - You may need to request quota increase
   - Consider using a different pricing tier

### Fallback Configuration

If Azure OpenAI is not available, the system will automatically fall back to:
1. OpenAI API (if configured)
2. Gemini API (if configured)
3. Local Ollama (if running)
4. Fallback responses (built-in)

## Cost Optimization

- **GPT-4o**: Best performance, moderate cost
- **GPT-4**: Good performance, higher cost
- **GPT-3.5-turbo**: Good performance, lower cost
- **GPT-4o-mini**: Basic performance, very low cost

## Security Best Practices

1. Never commit API keys to version control
2. Use environment variables for all sensitive data
3. Regularly rotate API keys
4. Monitor usage and costs in Azure Portal
5. Set up alerts for unusual usage patterns

## Support

- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)
- [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/)
- [Azure OpenAI Service Limits](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/quotas-limits)
