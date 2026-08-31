const request = require('supertest');

jest.mock('../lib/db', () => ({
  query: jest.fn()
}));

const db = require('../lib/db');

describe('Areas API', () => {
  let server;
  beforeAll(() => {
    server = require('next/dist/next-server/server/next-server');
  });

  test('sanity: db mock works', async () => {
    db.query.mockResolvedValue({ rows: [{ id:1, nombre:'Planta 1' }] });
    const areas = await db.query('SELECT 1');
    expect(areas.rows[0].nombre).toBe('Planta 1');
  });
});
