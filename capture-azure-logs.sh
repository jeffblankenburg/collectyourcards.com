#!/bin/bash

# Azure Log Capture Script for collectyourcards.com
# This script captures recent Azure logs for debugging

echo "🔍 Capturing Azure logs for collect-your-cards..."

# Ensure Azure CLI is logged in
if ! az account show &>/dev/null; then
    echo "❌ Please login to Azure first: az login"
    exit 1
fi

# Set your resource group name here
RESOURCE_GROUP="your-resource-group-name"
APP_NAME="collect-your-cards"
OUTPUT_FILE="azure-logs-$(date +%Y%m%d-%H%M%S).txt"

echo "📥 Downloading recent logs..."

# Capture last 100 lines of logs
az webapp log tail \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --lines 100 > $OUTPUT_FILE 2>&1 &

# Let it run for 30 seconds to capture recent activity
sleep 30
kill $! 2>/dev/null

echo "✅ Logs saved to: $OUTPUT_FILE"
echo ""
echo "📊 Log summary:"
echo "- Total lines: $(wc -l < $OUTPUT_FILE)"
echo "- Errors: $(grep -c "ERROR" $OUTPUT_FILE)"
echo "- Warnings: $(grep -c "WARN" $OUTPUT_FILE)"
echo ""
echo "You can now share this file with Claude using: Read $OUTPUT_FILE"