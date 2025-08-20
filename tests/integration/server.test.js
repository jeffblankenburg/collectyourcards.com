const request = require('supertest');
const express = require('express');

// Mock all the route modules since they don't exist yet
jest.mock('../../server/routes/auth', () => (req, res, next) => {
  res.json({ message: 'Auth route mock' });
}, { virtual: true });

jest.mock('../../server/routes/cards', () => (req, res, next) => {
  res.json({ message: 'Cards route mock' });
}, { virtual: true });

jest.mock('../../server/routes/collection', () => (req, res, next) => {
  res.json({ message: 'Collection route mock' });
}, { virtual: true });

jest.mock('../../server/routes/admin', () => (req, res, next) => {
  res.json({ message: 'Admin route mock' });
}, { virtual: true });

jest.mock('../../server/routes/import', () => (req, res, next) => {
  res.json({ message: 'Import route mock' });
}, { virtual: true });

jest.mock('../../server/routes/ebay', () => (req, res, next) => {
  res.json({ message: 'eBay route mock' });
}, { virtual: true });

describe('Server Configuration', () => {
  let app;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    
    // Import the server setup (not starting the actual server)
    const serverSetup = require('../../server/server-setup');
    app = serverSetup.app;
  });

  describe('Health Check Endpoint', () => {
    test('GET /health should return OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('/health response should have valid timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 1000); // Within last second
    });
  });

  describe('Security Middleware', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet.js security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:5173')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('Rate Limiting', () => {
    test('should accept requests within limit', async () => {
      await request(app)
        .get('/api/auth')
        .expect(200);
    });

    test('should apply rate limiting to API routes', async () => {
      // Test that rate limiting headers are present
      const response = await request(app)
        .get('/api/auth')
        .expect(200);

      // Modern rate limiting headers (no X- prefix)
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('API Routes', () => {
    test('GET /api/auth should route correctly', async () => {
      const response = await request(app)
        .get('/api/auth')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Auth route mock');
    });

    test('GET /api/cards should route correctly', async () => {
      const response = await request(app)
        .get('/api/cards')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Cards route mock');
    });

    test('GET /api/collection should route correctly', async () => {
      const response = await request(app)
        .get('/api/collection')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Collection route mock');
    });

    test('GET /api/admin should route correctly', async () => {
      const response = await request(app)
        .get('/api/admin')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Admin route mock');
    });

    test('GET /api/import should route correctly', async () => {
      const response = await request(app)
        .get('/api/import')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Import route mock');
    });

    test('GET /api/ebay should route correctly', async () => {
      const response = await request(app)
        .get('/api/ebay')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'eBay route mock');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('/non-existent-route');
    });

    test('should handle large JSON payloads within limit', async () => {
      const largePayload = { data: 'x'.repeat(1000) }; // Small payload within 10mb limit
      
      await request(app)
        .post('/api/auth')
        .send(largePayload)
        .expect(200);
    });

    test('should handle URL encoded data', async () => {
      await request(app)
        .post('/api/auth')
        .send('key=value&another=data')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);
    });
  });

  describe('Content Type Handling', () => {
    test('should parse JSON correctly', async () => {
      const testData = { test: 'data', number: 123 };
      
      await request(app)
        .post('/api/auth')
        .send(testData)
        .set('Content-Type', 'application/json')
        .expect(200);
    });

    test('should reject invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Server Environment Configuration', () => {
  test('should use correct environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.FRONTEND_URL).toBe('http://localhost:5173');
  });

  test('should have proper default values', () => {
    // Test that defaults are applied when env vars are missing
    delete process.env.FRONTEND_URL;
    delete process.env.PORT;
    
    // Re-require to test defaults
    jest.resetModules();
    const serverSetup = require('../../server/server-setup');
    
    // Defaults should be applied in server setup
    expect(serverSetup.config.frontendUrl).toBe('http://localhost:5174');
    expect(serverSetup.config.port).toBe(3001);
  });
});