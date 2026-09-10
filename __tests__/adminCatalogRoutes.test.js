const fs = require('fs');
const path = require('path');

describe('admin catalog routes', () => {
  test('areas route includes PUT update and DELETE by id', () => {
    const file = fs.readFileSync(path.join(__dirname, '../pages/api/areas.js'), 'utf8');
    expect(file).toContain("if (req.method === 'PUT')");
    expect(file).toContain('UPDATE areas SET nombre=$1 WHERE id=$2');
    expect(file).toContain('DELETE FROM areas WHERE id=$1');
  });

  test('maquinas route includes PUT update and DELETE by id', () => {
    const file = fs.readFileSync(path.join(__dirname, '../pages/api/maquinas.js'), 'utf8');
    expect(file).toContain("if(req.method==='PUT')");
    expect(file).toContain('UPDATE maquinas SET nombre=$1 WHERE id=$2');
    expect(file).toContain('DELETE FROM maquinas WHERE id=$1');
  });

  test('dynamic id routes exist for admin catalog editing', () => {
    const areaFile = fs.readFileSync(path.join(__dirname, '../pages/api/areas/[id].js'), 'utf8');
    const maquinaFile = fs.readFileSync(path.join(__dirname, '../pages/api/maquinas/[id].js'), 'utf8');

    expect(areaFile).toContain('UPDATE areas SET nombre=$1 WHERE id=$2');
    expect(maquinaFile).toContain('UPDATE maquinas SET nombre=$1 WHERE id=$2');
  });
});
