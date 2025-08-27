#!/bin/bash
# Deploy Daily Series Update Azure Function

echo "🚀 Deploying Daily Series Update Function..."

# Set variables
RESOURCE_GROUP="collect-your-cards_group"
FUNCTION_APP_NAME="collectyourcards-daily-functions"
LOCATION="eastus"
STORAGE_ACCOUNT="cycdailystorage"

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

# Get database connection info from main web app
echo "🔗 Getting database connection info..."
DB_SERVER=$(az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name collect-your-cards \
  --query "[?name=='DB_SERVER'].value | [0]" \
  --output tsv)

DB_USER=$(az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name collect-your-cards \
  --query "[?name=='DB_USER'].value | [0]" \
  --output tsv)

DB_PASSWORD=$(az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name collect-your-cards \
  --query "[?name=='DB_PASSWORD'].value | [0]" \
  --output tsv)

# Set application settings
echo "⚙️ Configuring application settings..."
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --settings \
  DB_SERVER="$DB_SERVER" \
  DB_DATABASE="CollectYourCards" \
  DB_USER="$DB_USER" \
  DB_PASSWORD="$DB_PASSWORD" \
  WEBSITE_RUN_FROM_PACKAGE="1"

if [ $? -eq 0 ]; then
    echo "✅ Application settings configured"
else
    echo "❌ Failed to configure application settings"
    exit 1
fi

# Build and deploy function
echo "📦 Building and deploying function..."
cd azure-functions/daily-series-update

# Install dependencies
echo "📥 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

# Deploy the function
echo "🚀 Deploying function to Azure..."
func azure functionapp publish $FUNCTION_APP_NAME --javascript

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Daily Series Update Function deployment complete!"
    echo "🔗 Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
    echo ""
    echo "📅 Schedule: Daily at 2:00 AM UTC"
    echo "⚙️ Monitor: az functionapp log tail --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME"
    echo ""
    echo "✅ Ready to run daily!"
else
    echo "❌ Function deployment failed"
    exit 1
fi