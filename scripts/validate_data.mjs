import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
let Ajv;
let addFormats;
try {
  Ajv = (await import('ajv')).default;
  addFormats = (await import('ajv-formats')).default;
} catch (err) {
  Ajv = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function validate() {
  let validate;
  const schema = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'schemas', 'strain.schema.json'), 'utf8'));
  if (Ajv) {
    const ajv = new Ajv({ allErrors: true });
    if (addFormats) addFormats(ajv);
    validate = ajv.compile(schema);
  } else {
    validate = (data) => typeof data.id === 'string' && typeof data.name === 'string';
  }
  const dir = path.join(__dirname, '..', 'data', 'published', 'strains');
  const files = await fs.readdir(dir);
  const errors = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    const valid = validate(data);
    if (!valid) {
      errors.push({ file, errors: Ajv ? validate.errors : [{ message: 'invalid data', path: '' }] });
    }
  }
  if (errors.length) {
    console.error('Validation failed');
    for (const e of errors) {
      console.error(`${e.file}:`, e.errors);
    }
    process.exit(1);
  }
  console.log('All data files valid');
}

validate();
