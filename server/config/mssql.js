/**
 * Shared MSSQL connection configuration
 *
 * This module provides a consistent way to connect to the database
 * using the raw mssql library, supporting both development (localhost)
 * and production (Azure SQL) environments.
 */

const sql = require('mssql')

// Parse DATABASE_URL for mssql connection (production)
const parseConnectionString = (connectionString) => {
  // Handle SQL Server connection string format: sqlserver://host:port;param=value;param=value
  const parts = connectionString.split(';')
  const serverPart = parts[0] // sqlserver://hostname:port

  // Extract server and port from first part
  const serverMatch = serverPart.match(/sqlserver:\/\/([^:]+):?(\d+)?/)
  const server = serverMatch ? serverMatch[1] : 'localhost'
  const port = serverMatch && serverMatch[2] ? parseInt(serverMatch[2]) : 1433

  // Parse remaining parameters
  const params = {}
  parts.slice(1).forEach(part => {
    const [key, value] = part.split('=')
    if (key && value) {
      params[key] = value
    }
  })

  const config = {
    server: server,
    port: port,
    database: params.database || 'CollectYourCards',
    user: params.user || 'sa',
    password: params.password || '',
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: params.encrypt === 'true',
      trustServerCertificate: params.trustServerCertificate === 'true'
    }
  }
  return config
}

/**
 * Get database configuration for mssql connections
 * Automatically detects production vs development environment
 */
const getDbConfig = () => {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    // Production: use DATABASE_URL parser
    console.log('🌐 MSSQL: Using production DATABASE_URL connection')
    return parseConnectionString(process.env.DATABASE_URL)
  }

  // Development: use existing environment variables
  console.log('🏠 MSSQL: Using development connection to localhost')
  return {
    server: process.env.DB_SERVER || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
    database: process.env.DB_NAME || 'CollectYourCards',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Password123',
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  }
}

// Shared connection pool (singleton)
let sharedPool = null

/**
 * Get or create a shared SQL connection pool
 * Use this for services that need a persistent connection
 */
const getPool = async () => {
  if (sharedPool && sharedPool.connected) {
    return sharedPool
  }

  const config = getDbConfig()
  sharedPool = await sql.connect(config)
  console.log('✅ MSSQL: Shared connection pool initialized')
  return sharedPool
}

/**
 * Create a new connection (for routes that manage their own connection)
 */
const createConnection = async () => {
  const config = getDbConfig()
  return await sql.connect(config)
}

module.exports = {
  sql,
  getDbConfig,
  getPool,
  createConnection,
  parseConnectionString
}
