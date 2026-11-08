import fs from 'node:fs';

const id = JSON.parse(fs.readFileSync(new URL('../messages/id.json', import.meta.url)));
if (!id || typeof id !== 'object' || !Object.keys(id).length) throw new Error('Kamus antarmuka Bahasa Indonesia kosong atau tidak valid.');
for (const section of Object.keys(id)) {
  if (!id[section] || typeof id[section] !== 'object') throw new Error(`Bagian kamus tidak valid: ${section}`);
}
for (const obsolete of ['../messages/en.json', '../components/language-switcher.tsx', '../components/demo-language-toggle.tsx']) {
  if (fs.existsSync(new URL(obsolete, import.meta.url))) throw new Error(`Berkas multibahasa lama masih ada: ${obsolete}`);
}
console.log(`Pemeriksaan Bahasa Indonesia saja lulus (${Object.keys(id).length} bagian copy).`);
