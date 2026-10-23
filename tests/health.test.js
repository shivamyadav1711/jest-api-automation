const request = require('supertest');

describe('Health Check', () => {
  test('should return status 200 and a success message', async () => {
    const response = await request('http://localhost:3000').get('/');

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'Salon Backend is running!'
    });
  });
});