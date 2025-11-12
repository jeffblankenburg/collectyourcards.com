/**
 * Image Optimization Utility
 *
 * Optimizes card images for web display by resizing and compressing
 * Creates web-friendly versions suitable for carousels and public display
 */

const sharp = require('sharp')
const { BlobServiceClient } = require('@azure/storage-blob')
const axios = require('axios')
const { getBlobName } = require('./azure-storage')

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const OPTIMIZED_CONTAINER_NAME = 'card-optimized'

// Image optimization settings
const IMAGE_CONFIG = {
  height: 300,           // Target height in pixels (2x carousel height for retina)
  quality: 85,           // JPEG quality (0-100)
  format: 'jpeg',        // Output format
  progressive: true,     // Progressive JPEG for better perceived loading
  fit: 'inside',         // Maintain aspect ratio, fit within bounds
  withoutEnlargement: true // Don't upscale small images
}

/**
 * Download an image from a URL
 * @param {string} url - The image URL to download
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    })
    return Buffer.from(response.data)
  } catch (error) {
    throw new Error(`Failed to download image from ${url}: ${error.message}`)
  }
}

/**
 * Optimize an image buffer
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimizeImage(imageBuffer) {
  try {
    const optimized = await sharp(imageBuffer)
      .resize({
        height: IMAGE_CONFIG.height,
        fit: IMAGE_CONFIG.fit,
        withoutEnlargement: IMAGE_CONFIG.withoutEnlargement
      })
      .jpeg({
        quality: IMAGE_CONFIG.quality,
        progressive: IMAGE_CONFIG.progressive
      })
      .toBuffer()

    return optimized
  } catch (error) {
    throw new Error(`Failed to optimize image: ${error.message}`)
  }
}

/**
 * Upload optimized image to Azure Storage
 * @param {Buffer} imageBuffer - Optimized image buffer
 * @param {string} blobName - Name for the blob (e.g., '12345_front.jpg')
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadOptimizedImage(imageBuffer, blobName) {
  try {
    if (!AZURE_STORAGE_CONNECTION_STRING) {
      throw new Error('Azure Storage connection string not configured')
    }

    // Create blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    const containerClient = blobServiceClient.getContainerClient(OPTIMIZED_CONTAINER_NAME)

    // Ensure container exists with public read access
    await containerClient.createIfNotExists({
      access: 'blob'
    })

    // Apply environment prefix (dev/ in development)
    const environmentBlobName = getBlobName(blobName)

    // Upload the optimized image
    const blockBlobClient = containerClient.getBlockBlobClient(environmentBlobName)
    await blockBlobClient.uploadData(imageBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg',
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    })

    return blockBlobClient.url
  } catch (error) {
    throw new Error(`Failed to upload optimized image: ${error.message}`)
  }
}

/**
 * Delete an optimized image from Azure Storage
 * @param {string} imageUrl - Full URL of the image to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteOptimizedImage(imageUrl) {
  try {
    if (!imageUrl || !AZURE_STORAGE_CONNECTION_STRING) {
      return false
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    const containerClient = blobServiceClient.getContainerClient(OPTIMIZED_CONTAINER_NAME)

    // Extract blob name from URL
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    const blobName = pathParts.slice(2).join('/') // Remove container name from path

    if (!blobName) {
      return false
    }

    // Delete the blob
    await containerClient.deleteBlob(blobName)
    console.log(`Deleted optimized image: ${blobName}`)
    return true
  } catch (error) {
    // Blob might not exist - that's okay
    if (error.statusCode === 404) {
      console.log(`Optimized image not found (already deleted): ${imageUrl}`)
      return false
    }
    throw new Error(`Failed to delete optimized image: ${error.message}`)
  }
}

/**
 * Process a card image: download, optimize, and upload
 * @param {string} sourceUrl - URL of the original image
 * @param {number} cardId - Card ID for naming
 * @param {string} side - 'front' or 'back'
 * @returns {Promise<string>} URL of the optimized image
 */
async function processCardImage(sourceUrl, cardId, side) {
  try {
    if (!sourceUrl) {
      throw new Error('Source URL is required')
    }

    console.log(`Processing ${side} image for card ${cardId}...`)

    // Download original image
    const originalBuffer = await downloadImage(sourceUrl)
    console.log(`Downloaded original image: ${(originalBuffer.length / 1024).toFixed(2)} KB`)

    // Optimize image
    const optimizedBuffer = await optimizeImage(originalBuffer)
    console.log(`Optimized image: ${(optimizedBuffer.length / 1024).toFixed(2)} KB (${((optimizedBuffer.length / originalBuffer.length) * 100).toFixed(1)}% of original)`)

    // Generate blob name: cardId_side.jpg
    const blobName = `${cardId}_${side}.jpg`

    // Upload to Azure Storage
    const publicUrl = await uploadOptimizedImage(optimizedBuffer, blobName)
    console.log(`Uploaded optimized ${side} image: ${publicUrl}`)

    return publicUrl
  } catch (error) {
    throw new Error(`Failed to process ${side} image for card ${cardId}: ${error.message}`)
  }
}

module.exports = {
  processCardImage,
  optimizeImage,
  downloadImage,
  uploadOptimizedImage,
  deleteOptimizedImage,
  IMAGE_CONFIG
}
