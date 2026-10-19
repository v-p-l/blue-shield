// Fabrique le .zip à téléverser sur le Chrome Web Store : seulement ce que l'extension
// exécute (ni README, ni design/, ni tools/).
//
//   node tools/build-zip.mjs   ->  dist/blue-shield-<version>.zip
//
// Le zip est écrit ici plutôt qu'avec Compress-Archive : celui de Windows sépare les
// dossiers par des antislashs, ce que la spec ZIP interdit.

import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = ['manifest.json', 'background.js', 'content', 'popup', 'shared', 'welcome', 'icons'];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function collect(entry) {
  const full = join(ROOT, entry);
  if (!statSync(full).isDirectory()) return [{ name: entry, data: readFileSync(full) }];
  return readdirSync(full).flatMap((child) => collect(`${entry}/${child}`));
}

// Un zip minimal : une entrée deflate par fichier, puis l'index central.
function zip(files) {
  const parts = [];
  const index = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version minimale
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0x21, 12); // date : 1980-01-01, pour un zip reproductible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    index.push(central, nameBytes);
    offset += local.length + nameBytes.length + deflated.length;
  }
  const directory = Buffer.concat(index);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const { version } = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const files = SHIPPED.flatMap(collect);
const out = join(ROOT, 'dist', `blue-shield-${version}.zip`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zip(files));
console.log(`${out}  (${files.length} fichiers)`);
