# 🚀 Azure Functions Deployment Guide

## Prerequisites

1. **Azure CLI** installed and logged in
2. **Node.js 18+** installed
3. **Azure Functions Core Tools** installed

```bash
# Install Azure Functions Core Tools (if not already installed)
npm install -g azure-functions-core-tools@4

# Verify installation
func --version
```

## Step 1: Login and Set Subscription

```bash
# Login to Azure
az login

# Set the correct subscription
az account set --subscription "your-subscription-id"

# Verify you're in the right subscription
az account show
```

## Step 2: Create Azure Function App (if it doesn't exist)

```bash
# Set variables
RESOURCE_GROUP="collectyourcards-rg"
FUNCTION_APP_NAME="collectyourcards-functions"
LOCATION="eastus"
STORAGE_ACCOUNT="collectyourcardstorage"  # Use existing storage account

# Create Function App with Node.js 18 runtime
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name $FUNCTION_APP_NAME \
  --storage-account $STORAGE_ACCOUNT \
  --disable-app-insights false
```

## Step 3: Configure Application Settings

```bash
# Get your current DATABASE_URL from the web app
DATABASE_URL=$(az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name collect-your-cards \
  --query "[?name=='DATABASE_URL'].value | [0]" \
  --output tsv)

# Get your Azure Storage connection string
AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --resource-group $RESOURCE_GROUP \
  --name $STORAGE_ACCOUNT \
  --query connectionString \
  --output tsv)

# Set the application settings
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --settings \
  DATABASE_URL="$DATABASE_URL" \
  AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
  WEBSITE_RUN_FROM_PACKAGE="1"

echo "✅ Application settings configured"
```

## Step 4: Prepare and Deploy Function

```bash
# Navigate to the azure-functions directory
cd azure-functions

# Install dependencies
npm install

# Generate Prisma client for the function environment
npx prisma generate

# Deploy the function
func azure functionapp publish collectyourcards-functions --javascript

echo "🎉 Function deployed successfully!"
```

## Step 5: Verify Deployment

```bash
# Check function app status
az functionapp show \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query "{name:name, state:state, defaultHostName:defaultHostName}" \
  --output table

# List deployed functions
az functionapp function list \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query "[].{name:name, triggerType:config.bindings[0].type}" \
  --output table
```

## Step 6: Test the Function

```bash
# Test the timer function manually (this will process any pending queue items)
az functionapp function invoke \
  --resource-group $RESOURCE_GROUP \
  --function-app $FUNCTION_APP_NAME \
  --function-name spreadsheet-processor

echo "✅ Test invocation sent"
```

## Step 7: Monitor Function Logs

```bash
# Stream live logs
az functionapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME

# Or check recent logs
az functionapp log show \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME
```

## Testing the Complete Flow

### 1. Queue a Job via API
```bash
# First, get an auth token (replace with your admin credentials)
AUTH_TOKEN=$(curl -s -X POST https://collect-your-cards.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cardcollector@jeffblankenburg.com","password":"testpassword"}' \
  | jq -r '.token')

# Queue a spreadsheet generation job for set ID 6 (2024 Topps Update)
curl -X POST https://collect-your-cards.azurewebsites.net/api/spreadsheet-generation/queue/6 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"priority": 10}'
```

### 2. Check Queue Status
```bash
# Check the queue
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  https://collect-your-cards.azurewebsites.net/api/spreadsheet-generation/queue \
  | jq '.'
```

### 3. Monitor Processing
```bash
# The function runs every minute, so wait 1-2 minutes then check status
curl -s https://collect-your-cards.azurewebsites.net/api/spreadsheet-generation/status/6 \
  | jq '.'
```

## Troubleshooting

### Common Issues

**1. Prisma Client Not Found**
```bash
# Regenerate Prisma client in azure-functions directory
cd azure-functions
rm -rf node_modules/.prisma
npx prisma generate
func azure functionapp publish collectyourcards-functions --javascript
```

**2. Database Connection Issues**
```bash
# Verify DATABASE_URL is set correctly
az functionapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query "[?name=='DATABASE_URL']"
```

**3. Storage Account Issues**
```bash
# Verify storage connection string
az functionapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query "[?name=='AZURE_STORAGE_CONNECTION_STRING']"
```

### Debug Logs
```bash
# Enable detailed logging
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --settings \
  AzureWebJobsFeatureFlags="EnableWorkerIndexing" \
  FUNCTIONS_WORKER_RUNTIME="node"
```

## Expected Results

**Successful Deployment Shows:**
- Function App created and running
- Timer function `spreadsheet-processor` deployed
- Application settings configured
- Function processes queue every minute
- Generated Excel files uploaded to blob storage
- Database updated with file URLs

**Test with Small Set First:**
- Use set ID 6 (2024 Topps Update) for initial testing
- Should process ~1000 cards quickly
- Generated file will be ~50-100KB Excel file

## File Structure Check

Your `/azure-functions/` directory should have:
```
azure-functions/
├── host.json
├── local.settings.json
├── package.json
├── package-lock.json
├── prisma/
│   └── schema.prisma
└── spreadsheet-processor/
    ├── function.json
    └── index.js
```

## Production Considerations

**For Production Deployment:**
1. Use Premium App Service Plan for better performance
2. Configure Application Insights for monitoring
3. Set up alerts for function failures
4. Consider using managed identity for database connections
5. Implement retry policies and dead letter queues

**Resource Scaling:**
- Consumption plan: Good for testing, scales automatically
- Premium plan: Better for production, pre-warmed instances
- Dedicated plan: Most predictable performance