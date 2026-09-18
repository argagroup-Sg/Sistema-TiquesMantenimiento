const fs = require('fs');
const path = require('path');

describe('legacy relational inserts', () => {
  test('tickets API does not insert legacy text columns', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/api/tickets/index.js'), 'utf8');

    expect(source).not.toMatch(/INSERT INTO tickets\([\s\S]*solicitante\s*,\s*area\s*,\s*maquina/);
    expect(source).toMatch(/solicitante_id\s*,\s*area_id\s*,\s*maquina_id/);
  });

  test('escalados API does not insert legacy snapshot text columns', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/api/escalados/index.js'), 'utf8');

    expect(source).not.toMatch(/INSERT INTO escalados\([\s\S]*proveedor\s*,\s*estado\s*,\s*solicitante\s*,\s*area\s*,\s*maquina/);
    expect(source).toMatch(/proveedor_id\s*,\s*solicitante_id\s*,\s*area_id\s*,\s*maquina_id/);
  });

  test('escalados API keeps provider and responsible relational values and appends supplier to note', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/api/escalados/index.js'), 'utf8');

    expect(source).toMatch(/proveedor_id\s*!==\s*undefined/);
    expect(source).toMatch(/responsable_id\s*!==\s*undefined/);
    expect(source).toMatch(/Proveedor:\s*\$\{\s*proveedor\s*\}|Proveedor:\s*\$\{\s*normalizedProveedor\s*\}/);
  });
});
