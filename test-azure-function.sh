#!/bin/bash
# Test Azure Function deployment

echo "🧪 Testing Azure Function deployment..."

# Set variables
RESOURCE_GROUP="collectyourcards-rg"
FUNCTION_APP_NAME="collectyourcards-functions"
WEB_APP_URL="https://collect-your-cards.azurewebsites.net"

# Check if Function App is running
echo "🔍 Checking Function App status..."
FUNCTION_STATUS=$(az functionapp show \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query state \
  --output tsv 2>/dev/null)

if [ "$FUNCTION_STATUS" = "Running" ]; then
    echo "✅ Function App is running"
else
    echo "❌ Function App is not running (status: $FUNCTION_STATUS)"
    exit 1
fi

# List deployed functions
echo "📋 Listing deployed functions..."
az functionapp function list \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --query "[].{name:name, triggerType:config.bindings[0].type}" \
  --output table

# Test the API endpoints
echo "🔧 Testing API endpoints..."

# Test health endpoint
echo "Testing web app health..."
HEALTH_RESPONSE=$(curl -s "$WEB_APP_URL/api/health")
if echo "$HEALTH_RESPONSE" | grep -q "OK"; then
    echo "✅ Web app health check passed"
else
    echo "❌ Web app health check failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test spreadsheet status endpoint
echo "Testing spreadsheet status endpoint..."
STATUS_RESPONSE=$(curl -s "$WEB_APP_URL/api/spreadsheet-generation/status/6")
if echo "$STATUS_RESPONSE" | grep -q "set_id"; then
    echo "✅ Spreadsheet status endpoint working"
    echo "Status: $(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')"
else
    echo "❌ Spreadsheet status endpoint failed"
    echo "Response: $STATUS_RESPONSE"
fi

echo ""
echo "🔍 Function App Information:"
echo "URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo ""
echo "📊 Next Steps:"
echo "1. Monitor function logs: az functionapp log tail --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME"
echo "2. Test with admin credentials to queue a job"
echo "3. Check database for queue entries"
echo ""
echo "🧪 Manual Test Commands:"
echo ""
echo "# Get auth token (replace credentials):"
echo "AUTH_TOKEN=\$(curl -s -X POST $WEB_APP_URL/api/auth/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"email\":\"cardcollector@jeffblankenburg.com\",\"password\":\"testpassword\"}' \\"
echo "  | jq -r '.token')"
echo ""
echo "# Queue a test job:"
echo "curl -X POST $WEB_APP_URL/api/spreadsheet-generation/queue/6 \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
echo "  -d '{\"priority\": 10}'"
echo ""
echo "# Check queue:"
echo "curl -s -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
echo "  $WEB_APP_URL/api/spreadsheet-generation/queue | jq '.'"
echo ""
echo "✅ Deployment test complete!"