/**
 * Configure CORS for Azure Blob Storage
 *
 * This script sets up CORS rules to allow the ImageEditor to load and save images
 * from the Azure Blob Storage containers.
 *
 * Usage: node server/scripts/configure-azure-cors.js
 */

const { BlobServiceClient } = require('@azure/storage-blob')

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING

async function configureCORS() {
  if (!AZURE_STORAGE_CONNECTION_STRING) {
    console.error('❌ AZURE_STORAGE_CONNECTION_STRING environment variable not set')
    process.exit(1)
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)

    // Define CORS rules
    const corsRules = [
      {
        allowedOrigins: '*', // In production, replace with specific domains
        allowedMethods: 'GET,HEAD,OPTIONS',
        allowedHeaders: '*',
        exposedHeaders: '*',
        maxAgeInSeconds: 3600
      }
    ]

    // Set CORS properties
    await blobServiceClient.setProperties({
      cors: corsRules
    })

    console.log('✅ CORS configuration updated successfully!')
    console.log('\nCORS Rules:')
    console.log(JSON.stringify(corsRules, null, 2))
    console.log('\n⚠️  Note: In production, replace allowedOrigins: "*" with specific domains:')
    console.log('   allowedOrigins: "https://collectyourcards.com"')

  } catch (error) {
    console.error('❌ Failed to configure CORS:', error.message)
    console.error('\nError details:', error)
    process.exit(1)
  }
}

configureCORS()
  .then(() => {
    console.log('\n✓ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error)
    process.exit(1)
  })
