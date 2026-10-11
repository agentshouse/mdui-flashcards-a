import {describe, it, expect} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';
import {DateTime} from 'luxon';
import {gradeCard, isDue} from '../src/data/schedule';
import {SafeMarkdown} from '../src/components/SafeMarkdown';
import {CardInputSchema} from '../src/schemas/cardInput';
import {CreateDeckInputSchema} from '../src/schemas/createDeckInput';
import type {Card} from '../src/data/model';
const parsedNow = DateTime.fromISO('2026-10-11T08:00:00.000Z', {zone:'utc'});
if (!parsedNow.isValid) throw new Error('Invalid test timestamp');
const now = parsedNow;
const card: Card = {id:'a',deckId:'d',front:'Question',back:'Answer',createdAt:now.toISO()!,updatedAt:now.toISO()!,streak:0,intervalDays:0,nextReviewAt:now.toISO()!};
afterEach(cleanup);
describe('unchanged donor repetition algorithm', () => {
 it.each([[0,1],[1,3],[2,6],[3,8],[29,60],[50,60]])('streak %i schedules %i days', (streak, expected) => {
  const next = gradeCard({...card,streak},true,now);
  expect(next.streak).toBe(streak+1);expect(next.intervalDays).toBe(expected);expect(next.nextReviewAt).toBe(now.plus({days:expected}).toISO());
 });
 it('forget resets due now and preserves content/creation', () => {const result=gradeCard({...card,streak:12,intervalDays:24},false,now);expect(result).toEqual(card);});
 it('does not mutate opened input', () => {gradeCard(card,true,now);expect(card.streak).toBe(0);});
 it('due boundary is inclusive', () => {expect(isDue(card,now)).toBe(true);expect(isDue(card,now.minus({seconds:1}))).toBe(false);expect(isDue(card,now.plus({seconds:1}))).toBe(true);});
});
describe('Markdown resource safety', () => {
 it.each([
  '![remote](https://example.invalid/track.png)',
  '<img src="https://example.invalid/x" srcset="https://example.invalid/y 2x" onerror="alert(1)">',
  '<iframe src="https://example.invalid"></iframe><video src="https://example.invalid/x"></video>',
  '<script>alert(1)</script><style>@import "https://example.invalid"</style>',
  '[bad](javascript:alert(1)) [remote](https://example.invalid) <a href="https://example.invalid">link</a>',
  '<svg><image href="https://example.invalid/x"/></svg><object data="https://example.invalid/x"></object>',
 ])('cannot load external resources: %s', source => {
  const {container}=render(<SafeMarkdown source={source}/>);
  expect(container.querySelectorAll('img,iframe,video,audio,source,script,style,object,embed,svg image').length).toBe(0);
  expect(container.querySelectorAll('[src],[srcset],[href],[data],[onerror],[onclick]').length).toBe(0);
 });
 it('keeps normal Markdown formatting', () => {const {container}=render(<SafeMarkdown source={'# Title\n\n**Bold** and `code`\n\n- Item'}/>);expect(container.querySelector('h1')?.textContent).toBe('Title');expect(container.querySelector('strong')?.textContent).toBe('Bold');expect(container.querySelector('li')?.textContent).toBe('Item');});
});
describe('donor form input constraints', () => {
 it('validates Markdown without transforming its exact text', () => {
  const input = {front: '\n    indented code\n\n', back: '\tindented answer\nline break  \n'};
  expect(CardInputSchema.parse(input)).toEqual(input);
 });
 it.each(['', ' ', '\n\n', '\t  \n'])('rejects a whitespace-only Markdown face: %j', blank => {
  expect(CardInputSchema.safeParse({front: blank, back: 'answer'}).success).toBe(false);
  expect(CardInputSchema.safeParse({front: 'question', back: blank}).success).toBe(false);
 });
 it('requires collection name',()=>{expect(CreateDeckInputSchema.safeParse({name:'   '}).success).toBe(false);});
 it('requires both card sides',()=>{expect(CardInputSchema.safeParse({front:' ',back:'answer'}).success).toBe(false);expect(CardInputSchema.safeParse({front:'question',back:''}).success).toBe(false);});
});
