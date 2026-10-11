import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname,'..');
const dist = path.join(root,'dist');
function files(directory) {return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{assert(!entry.isSymbolicLink());const target=path.join(directory,entry.name);return entry.isDirectory()?files(target):[target];});}
const output=files(dist); const bytes=output.reduce((sum,file)=>sum+fs.statSync(file).size,0);
assert(output.length<=2000);assert(bytes<=20*1024*1024);
for(const name of ['app.json','schema.yaml']) assert.equal(fs.readFileSync(path.join(root,name),'utf8'),fs.readFileSync(path.join(dist,name),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'LICENSE'),'utf8'),fs.readFileSync(path.join(dist,'LICENSE.txt'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'app.json'),'utf8'));
assert.equal(manifest.entry,'index.html');assert.equal(manifest.room_slots.length,1);
assert(!manifest.external_calls && !manifest.external_origins);
const references=new Set();
function asset(value,from) {
 if(value.startsWith('data:')||value.startsWith('#'))return;
 assert(!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value),`External resource ${value}`);
 const name=decodeURIComponent(value.split(/[?#]/)[0]);const target=path.resolve(path.dirname(from),name);
 assert(target.startsWith(dist+path.sep));assert(fs.existsSync(target),`Missing resource ${value}`);references.add(path.relative(dist,target));
}
for(const file of output){const text=fs.readFileSync(file,'utf8');
 if(file.endsWith('.html')){
  assert(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(text),'Inline script in release entry');
  for(const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))asset(match[1],file);
 }
 if(file.endsWith('.css'))for(const match of text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\)/g))asset(match[1],file);
 if(file.endsWith('.js')){
  assert(!/images\.unsplash\.com|www\.markdownguide\.org|barabara\.megafarad|localStorage|flashcards:v1/.test(text),'Forbidden donor runtime dependency');
  assert(!/\b(?:fetch|open)\s*\(\s*["']https?:\/\//.test(text),'Literal external runtime request');
 }
}
for(let i=1;i<=9;i++)asset(`./artwork/card-${i}.svg`,path.join(dist,'index.html'));
for(const name of ['markdown-help.html','LICENSE.txt','THIRD_PARTY_NOTICES.txt'])asset('./'+name,path.join(dist,'index.html'));
for(const file of files(path.join(root,'src'))){const source=fs.readFileSync(file,'utf8');assert(!/localStorage|connectMdRuntime|serveMdRuntime|createMemoryAdapter/.test(source),`Forbidden production API: ${file}`);}
const report={result:'passed',files:output.length,bytes,mebibytes:+(bytes/1024/1024).toFixed(3),references:[...references],manifestSha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),networkScope:'Static entry, CSS, donor URLs, literal request audit and Markdown tests. Hosted network capture not yet run.',browser:'Hosted desktop/360px unverified',publication:'Static artifact audit; remote release and binding status verified separately'};
fs.writeFileSync(path.join(root,'.build/release-audit.json'),JSON.stringify(report,null,2)+'\n');
execFileSync(process.execPath,[path.join(root,'scripts/check-schema.mjs')],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify(report,null,2));
