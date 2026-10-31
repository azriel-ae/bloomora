import fs from 'node:fs';
const id = JSON.parse(fs.readFileSync(new URL('../messages/id.json', import.meta.url)));
const en = JSON.parse(fs.readFileSync(new URL('../messages/en.json', import.meta.url)));
const missing = [];
for (const section of Object.keys(id)) for (const key of Object.keys(id[section])) if (!(section in en) || !(key in en[section])) missing.push(`${section}.${key}`);
if (missing.length) { console.error(`Missing English translation keys: ${missing.join(', ')}`); process.exit(1); }
console.log(`Translation parity check passed for ${Object.keys(id).length} sections.`);
