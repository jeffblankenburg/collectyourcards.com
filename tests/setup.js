// Test environment setup
require('dotenv').config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock email service to prevent actual emails during testing
jest.mock('../server/services/emailService', () => {
  return require('./__mocks__/emailService')
});

// Global test utilities
global.testUtils = {
  createTestUser: () => ({
    email: 'test@example.com',
    password: 'testPassword123!',
    name: 'Test User'
  }),
  
  createTestCard: () => ({
    card_number: '1',
    series: 1,
    is_rookie: false,
    is_autograph: false,
    is_relic: false
  })
};