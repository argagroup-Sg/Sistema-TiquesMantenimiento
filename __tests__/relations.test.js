const { resolveIdFromReference, buildNameMapFromRows } = require('../lib/relations');

describe('relation helpers', () => {
  test('resolveIdFromReference accepts id directly and resolves name when needed', () => {
    expect(resolveIdFromReference(7, 'users')).toBe(7);
    expect(resolveIdFromReference('Pedro', 'users', 'nombre')).toBe('Pedro');
  });

  test('buildNameMapFromRows normalizes rows into lookup objects', () => {
    const rows = [
      { id: 1, nombre: 'Entrada' },
      { id: 2, nombre: 'Mantenimiento' }
    ];

    expect(buildNameMapFromRows(rows)).toEqual({
      '1': 'Entrada',
      '2': 'Mantenimiento'
    });
  });
});
