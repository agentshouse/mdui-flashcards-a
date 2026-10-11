import {DateTime} from 'luxon';
import type {Card} from './model';
/** Original barabara schedule, extracted unchanged for deterministic tests. */
export function gradeCard(card: Card, knew: boolean, now = DateTime.now()): Card {
  const streak = knew ? card.streak + 1 : 0;
  const intervalDays = knew ? (streak === 1 ? 1 : streak === 2 ? 3 : Math.min(streak * 2, 60)) : 0;
  return {...card, streak, intervalDays, nextReviewAt: now.plus({days: intervalDays}).toISO()!};
}
export function isDue(card: Card, now = DateTime.now()): boolean {return DateTime.fromISO(card.nextReviewAt).toMillis() <= now.toMillis();}
