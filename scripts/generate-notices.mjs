import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, '.build'), { recursive: true });
const donor = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
assert.equal(createHash('sha256').update(donor).digest('hex'), '206d5a0ab3aec79e0ac57deab6368a53a8256b9fc1c761beedcf9290d3f42410', 'Pinned donor license changed');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const notices = ['FLASHCARDS — THIRD-PARTY NOTICES\n\nAdapted from megafarad/barabara at4005955f9fc6865f4eca20496ac15e36579b80d8.\nSource: https://github.com/megafarad/barabara/tree/4005955f9fc6865f4eca20496ac15e36579b80d8\n\n'+donor, '\nOriginal replacement artwork in artwork/ and icon.svg is supplied under this App’s MIT terms. Donor Unsplash images, SVG Repo favicon, React logo and unattributed quotations are omitted.\n\nDependency notices below cover the installed production dependency closure, a superset of the actual runtime bundle. Build/test tools are not bundled.'];
const supplements = JSON.parse(fs.readFileSync(path.join(root, 'scripts/supplemental-licenses.json'), 'utf8'));
const packages = []; const missing = [];
for (const [relative, entry] of Object.entries(lock.packages)) {
 if (!relative || entry.dev) continue;
 const directory = path.join(root, relative);
 if (!fs.existsSync(path.join(directory, 'package.json'))) {if (!entry.optional) missing.push(relative); continue;}
 const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
 const license = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'Not declared');
 const files = fs.readdirSync(directory).filter(name => /^(licen[cs]e|notice|copying|copyright|ofl)(?:[._-]|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
 packages.push({name: pkg.name, version: pkg.version, license, files});
 notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${license}\n`);
 if (!files.length) {const supplement = supplements.find(item => item.name === pkg.name && item.version === pkg.version); if (!supplement) missing.push(`${pkg.name}@${pkg.version}`);}
 for (const file of files) notices.push(`\n--- ${file} ---\n${fs.readFileSync(path.join(directory, file), 'utf8')}`);
 assert(!/^(UNLICENSED|Not declared)$/.test(license), `${pkg.name}: license not available`);
}
for (const item of supplements) {const data = fs.readFileSync(path.join(root, 'public', item.file)); assert.equal(createHash('sha256').update(data).digest('hex'), item.sha256); notices.push(`\n${'='.repeat(72)}\n${item.name} ${item.version}\nSource: ${item.source}\n${item.note}\n\n${data.toString('utf8')}`);}
fs.writeFileSync(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), notices.join('\n')+'\n');
fs.writeFileSync(path.join(root, '.build/license-audit.json'), JSON.stringify({donorCommit:'4005955f9fc6865f4eca20496ac15e36579b80d8', donorLicenseSha256:createHash('sha256').update(donor).digest('hex'), packages, supplements, missing}, null, 2)+'\n');
console.log(JSON.stringify({packages: packages.length, missing}));
assert.equal(missing.length, 0, 'Production package license texts require review');
