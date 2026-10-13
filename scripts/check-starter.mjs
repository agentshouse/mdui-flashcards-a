import { checkCurrentStarter } from './check-current-starter.mjs';
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verify, validate, parse } from '@agentshouse/mdmodel'
const schema = fs.readFileSync('schema.yaml', 'utf8')
const model = verify(schema)
assert.equal(model.verdict, 'accept')
const documents = {}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink())
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else { assert(entry.isFile() && file.endsWith('.md')); documents[path.relative('starter', file)] = fs.readFileSync(file, 'utf8') }
  }
}
walk('starter')
assert(Object.keys(documents).length > 0)
assert.equal(validate({ 'settings/schema.yaml': schema, ...documents }, { binaryTargets: [] }, model.model).verdict, 'accept')
checkCurrentStarter(documents);
for (const [file, content] of Object.entries(documents)) {
  const result = parse(content, file); assert(result.ok)
  if (result.document.type === 'flashcard_card') {
    const reference = path.posix.normalize(path.posix.join(path.posix.dirname(file), result.document.fields.deck))
    assert(documents[reference], 'Missing referenced deck.')
    const deck = parse(documents[reference], reference); assert(deck.ok)
    assert.equal(result.document.fields.deckId, deck.document.fields.id)
  }
}
console.log(`PASS: ${Object.keys(documents).length} current Starter records with deck closure.`)
