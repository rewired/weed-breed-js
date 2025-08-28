import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
let validate;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../shared/schemas/strain.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

try {
  const Ajv = (await import('ajv')).default;
  const addFormats = (await import('ajv-formats')).default;
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  validate = ajv.compile(schema);
} catch {
  validate = (data) => {
    const errors = [];
    if (typeof data.id !== 'string') errors.push({ message: 'id must be string', path: '/id' });
    if (typeof data.name !== 'string') errors.push({ message: 'name required', path: '/name' });
    if (!data.genotype) errors.push({ message: 'genotype required', path: '/genotype' });
    return { valid: errors.length === 0, errors };
  };
}

export function validateStrain(data) {
  const result = validate(data);
  if (typeof result === 'object') {
    return result;
  }
  return { valid: result, errors: validate.errors ? validate.errors.map(e => ({ message: e.message, path: e.instancePath })) : [] };
}
