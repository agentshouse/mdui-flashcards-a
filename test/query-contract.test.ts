import {describe, expect, it} from 'vitest';
import {flashcardQuery} from '../src/data/house';
import {assertQueryPointers, rejectedPointerQueries} from './query-pointers';

describe('current Runtime JSON Pointer query contract', () => {
  it('validates the actual production query and retains metadata ordering/all-fields projection', () => {
    assertQueryPointers(flashcardQuery);
    expect(flashcardQuery.orderBy).toEqual([{by: {field: '/createdAt'}, direction: 'asc'}, {by: 'path', direction: 'asc'}]);
    expect(flashcardQuery.select).toEqual({fields: 'all', markdown: true});
    assertQueryPointers({select: {fields: ['/a~1b/c~0d', '/assignee/0'], sections: ['Notes']}, where: {$or: [{'/title': 'x'}, {'/nested/title': 'y'}]}});
  });
  it('rejects bare names in every frontmatter query position and malformed pointer escapes', () => {
    for (const query of rejectedPointerQueries) expect(() => assertQueryPointers(query)).toThrow(/expects a JSON Pointer/);
  });
});
