# CollectYourCards Azure Functions

Background processing functions for spreadsheet generation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Start local development:
```bash
npm start
```

## Function: spreadsheet-processor

**Trigger**: Timer (every minute)
**Purpose**: Processes pending spreadsheet generation jobs from the queue

### Process Flow:
1. Checks database for pending jobs (highest priority first)
2. Marks job as "processing"
3. Generates multi-tab Excel file with:
   - Master List (all cards)
   - Summary (statistics)
   - Individual series tabs
4. Uploads to Azure Blob Storage
5. Updates database with completion status and blob URL

### Configuration:
- Timer: Every minute (`0 */1 * * * *`)
- Timeout: 10 minutes
- Concurrency: 1 (processes one job at a time)

## Deployment

```bash
# Login to Azure
az login

# Create function app (if not exists)
az functionapp create \
  --resource-group your-resource-group \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name collectyourcards-functions \
  --storage-account your-storage-account

# Deploy
func azure functionapp publish collectyourcards-functions
```

## Environment Variables (Production)

Set these in Azure Function App Configuration:
- `DATABASE_URL` - Production database connection
- `AZURE_STORAGE_CONNECTION_STRING` - Blob storage for files