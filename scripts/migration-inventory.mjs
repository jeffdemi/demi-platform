import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const directory = resolve(import.meta.dirname, '../supabase/migrations');
console.log('version,name,sha256');
for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) throw new Error(`Unexpected migration filename: ${file}`);
  console.log(`${file.slice(0,14)},${file.slice(15,-4)},${createHash('sha256').update(readFileSync(resolve(directory,file))).digest('hex')}`);
}
