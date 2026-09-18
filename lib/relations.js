function asNumberId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function asText(value) {
  return String(value ?? '').trim();
}

function resolveIdFromReference(value, tableName, nameColumn = 'nombre') {
  const numeric = asNumberId(value);
  if (numeric !== null) return numeric;
  const text = asText(value);
  if (!text) return null;
  return text;
}

function buildNameMapFromRows(rows = []) {
  const map = {};
  for (const row of rows) {
    if (!row || row.id === undefined || row.id === null) continue;
    map[String(row.id)] = row.nombre || row.name || '';
  }
  return map;
}

module.exports = {
  asNumberId,
  asText,
  resolveIdFromReference,
  buildNameMapFromRows
};
