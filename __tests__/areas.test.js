jest.mock('../lib/db', () => ({
  query: jest.fn()
}));

const db = require('../lib/db');

describe('DB mock sanity', () => {
  test('db.query mock resolves as expected', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, nombre: 'Planta 1' }] });
    const res = await db.query('SELECT 1');
    expect(res.rows).toBeDefined();
    expect(res.rows[0].nombre).toBe('Planta 1');
  });
});
