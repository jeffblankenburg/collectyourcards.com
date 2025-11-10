#!/bin/bash
# Deploy Spreadsheet Generation Azure Function

echo "🚀 Deploying Spreadsheet Generation Function..."

# Set variables
RESOURCE_GROUP="collect-your-cards_group"
FUNCTION_APP_NAME="collectyourcards-spreadsheet-functions"
LOCATION="eastus"
STORAGE_ACCOUNT="cycspreadsheetstorage"

# Check if logged in to Azure
echo "🔐 Checking Azure login..."
if ! az account show >/dev/null 2>&1; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Get current subscription info
SUBSCRIPTION_NAME=$(az account show --query name --output tsv)
echo "✅ Using subscription: $SUBSCRIPTION_NAME"

# Create storage account for function app if it doesn't exist
echo "🗄️ Creating storage account for function app..."
if ! az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP >/dev/null 2>&1; then
    az storage account create \
      --name $STORAGE_ACCOUNT \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --sku Standard_LRS \
      --kind StorageV2

    if [ $? -ne 0 ]; then
        echo "❌ Failed to create storage account"
        exit 1
    fi
    echo "✅ Storage account created"
else
    echo "✅ Storage account already exists"
fi

# Check if Function App already exists
echo "🔍 Checking if Function App exists..."
if az functionapp show --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME >/dev/null 2>&1; then
    echo "✅ Function App $FUNCTION_APP_NAME already exists"
else
    echo "📋 Creating Azure Function App..."
    az functionapp create \
      --resource-group $RESOURCE_GROUP \
      --consumption-plan-location $LOCATION \
      --runtime node \
      --runtime-version 22 \
      --functions-version 4 \
      --name $FUNCTION_APP_NAME \
      --storage-account $STORAGE_ACCOUNT \
      --disable-app-insights false

    if [ $? -eq 0 ]; then
        echo "✅ Function App created successfully"
    else
        echo "❌ Failed to create Function App"
        exit 1
    fi
fi

# Get DATABASE_URL from main web app
echo "🔗 Getting DATABASE_URL from web app..."
DATABASE_URL=$(az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name collect-your-cards \
  --query "[?name=='DATABASE_URL'].value | [0]" \
  --output tsv)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Could not retrieve DATABASE_URL from web app"
    exit 1
fi

# Get Azure Storage connection string for blob storage
echo "🗄️ Getting Azure Storage connection string for blobs..."
AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --resource-group $RESOURCE_GROUP \
  --name collectyourcardsstorage \
  --query connectionString \
  --output tsv)

if [ -z "$AZURE_STORAGE_CONNECTION_STRING" ]; then
    echo "❌ Could not retrieve Azure Storage connection string"
    exit 1
fi

# Set application settings
echo "⚙️ Configuring application settings..."
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --settings \
  DATABASE_URL="$DATABASE_URL" \
  AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
  WEBSITE_RUN_FROM_PACKAGE="1"

if [ $? -eq 0 ]; then
    echo "✅ Application settings configured"
else
    echo "❌ Failed to configure application settings"
    exit 1
fi

# Build and deploy function
echo "📦 Building and deploying function..."
cd azure-functions/spreadsheet-processor

# Install production dependencies only (excludes 1.3GB azure-functions-core-tools)
echo "📥 Installing production dependencies only..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

# Generate Prisma client (npx will download prisma temporarily if needed)
echo "🔧 Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma generate failed"
    exit 1
fi

# Deploy the function
echo "🚀 Deploying function to Azure..."
func azure functionapp publish $FUNCTION_APP_NAME --javascript

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Spreadsheet Generation Function deployment complete!"
    echo "🔗 Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
    echo ""
    echo "📅 Schedule: Every minute (for testing)"
    echo "⚙️ Monitor: az functionapp log tail --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME"
    echo ""
    echo "✅ Ready to process spreadsheet generation queue!"
else
    echo "❌ Function deployment failed"
    exit 1
fi
