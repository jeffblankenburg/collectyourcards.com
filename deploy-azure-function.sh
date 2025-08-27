#!/bin/bash
# Deploy Azure Function for spreadsheet generation

echo "🚀 Deploying Azure Function for spreadsheet generation..."

# Set variables
RESOURCE_GROUP="collect-your-cards_group"
FUNCTION_APP_NAME="collectyourcards-functions"
LOCATION="eastus"
STORAGE_ACCOUNT="collectyourcardsstorage"
FUNCTION_STORAGE_ACCOUNT="cycstoragefunctions"  # New storage account for functions

# Check if logged in to Azure
echo "🔐 Checking Azure login..."
if ! az account show >/dev/null 2>&1; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Get current subscription info
SUBSCRIPTION_NAME=$(az account show --query name --output tsv)
echo "✅ Using subscription: $SUBSCRIPTION_NAME"

# Check if Function App already exists
echo "🔍 Checking if Function App exists..."
if az functionapp show --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME >/dev/null 2>&1; then
    echo "✅ Function App $FUNCTION_APP_NAME already exists"
else
    # Create storage account for function app if it doesn't exist
    echo "🗄️ Creating storage account for function app..."
    if ! az storage account show --name $FUNCTION_STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP >/dev/null 2>&1; then
        az storage account create \
          --name $FUNCTION_STORAGE_ACCOUNT \
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

    echo "📋 Creating Azure Function App..."
    az functionapp create \
      --resource-group $RESOURCE_GROUP \
      --consumption-plan-location $LOCATION \
      --runtime node \
      --runtime-version 22 \
      --functions-version 4 \
      --name $FUNCTION_APP_NAME \
      --storage-account $FUNCTION_STORAGE_ACCOUNT \
      --disable-app-insights false
    
    if [ $? -eq 0 ]; then
        echo "✅ Function App created successfully"
    else
        echo "❌ Failed to create Function App"
        exit 1
    fi
fi

# Get DATABASE_URL from existing web app
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

# Get Azure Storage connection string
echo "🗄️ Getting Azure Storage connection string..."
AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --resource-group $RESOURCE_GROUP \
  --name $STORAGE_ACCOUNT \
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

# Check if we're in the right directory
if [ ! -d "azure-functions" ]; then
    echo "❌ azure-functions directory not found. Please run from project root."
    exit 1
fi

# Build and deploy function
echo "📦 Building and deploying function..."
cd azure-functions

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in azure-functions directory"
    exit 1
fi

# Install dependencies
echo "📥 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

# Generate Prisma client
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
    echo "🎉 Azure Function deployment complete!"
    echo "🔗 Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
    echo ""
    echo "📊 To test the function:"
    echo "1. Queue a job via the web app admin panel"
    echo "2. Or use the API: POST /api/spreadsheet-generation/queue/{setId}"
    echo "3. Monitor logs: az functionapp log tail --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME"
    echo ""
    echo "✅ Ready for testing!"
else
    echo "❌ Function deployment failed"
    exit 1
fi