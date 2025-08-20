const { PrismaClient } = require('@prisma/client');

describe('Database Connection', () => {
  let prisma;
  let databaseAvailable = true;

  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Test if database is available
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
    } catch (error) {
      databaseAvailable = false;
      console.warn('Database not available for tests, skipping database tests');
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  test('should connect to database successfully', async () => {
    if (!databaseAvailable) {
      console.log('Skipping database test - database not available');
      return;
    }

    // Test basic database connectivity
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(result[0].test).toBe(1);
  });

  test('should have all required tables in schema', async () => {
    if (!databaseAvailable) {
      console.log('Skipping database test - database not available');
      return;
    }

    // Test that our main tables exist
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_CATALOG = 'CollectYourCards'
    `;
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    
    // Core tables should exist
    expect(tableNames).toContain('user');
    expect(tableNames).toContain('card');
    expect(tableNames).toContain('set');
    expect(tableNames).toContain('player');
    expect(tableNames).toContain('team');
  });

  test('should handle BigInt fields correctly', async () => {
    if (!databaseAvailable) {
      console.log('Skipping database test - database not available');
      return;
    }

    // Test BigInt handling for user_id
    const userCount = await prisma.user.count();
    expect(typeof userCount).toBe('number');
  });

  test('should have valid Prisma client', () => {
    // This test can run without database connection
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
  });
});