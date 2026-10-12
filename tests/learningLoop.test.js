import test from 'node:test';
import assert from 'node:assert/strict';
import { activityDays, bookLoop, heatmap, levelFor, localDay, progressSince, quizXp, sessionsThisWeek, streak, streakCard, streakHand } from '../src/lib/learningLoop.js';

const book = (studyLog, slug = 'naked-statistics') => ({ slug, title: 'Naked Statistics', studyLog });
const entry = (date, step, extra = {}) => ({ _key: `${date}-${step}`, date, step, ...extra });

test('a loop closes once every step has been done, in any order, and earns a bonus', () => {
  const loop = bookLoop(book([
    entry('2026-10-01', 'Read'),
    entry('2026-10-02', 'Paraphrase'),
    entry('2026-10-03', 'Apply'),
    entry('2026-10-04', 'Note'),
    entry('2026-10-05', 'Read'),
  ]));
  assert.equal(loop.loops, 1);
  assert.equal(loop.xp, 10 + 15 + 25 + 15 + 25 + 10);
  assert.deepEqual(loop.done, [true, false, false, false], 'the second loop has started with a Read');
  assert.equal(loop.nextStep, 'Paraphrase');
  assert.equal(loop.lastEntry.day, '2026-10-05');
  assert.deepEqual(loop.counts, { Read: 2, Paraphrase: 1, Note: 1, Apply: 1, Quiz: 0 });
});

test('linked Today I Learned notes count as Note steps for their book only', () => {
  const notes = [
    { slug: 'a', title: 'Sampling bias', publishedAt: '2026-10-02T15:00:00Z', resourceSlug: 'naked-statistics' },
    { slug: 'b', title: 'Unrelated', publishedAt: '2026-10-02T15:00:00Z', resourceSlug: 'other-book' },
    { slug: 'c', title: 'Unlinked', publishedAt: '2026-10-02T15:00:00Z' },
  ];
  const loop = bookLoop(book([entry('2026-10-01', 'Read')]), notes);
  assert.equal(loop.counts.Note, 1);
  assert.equal(loop.entries.find((item) => item.step === 'Note').href, '/notes/a');
  assert.deepEqual(loop.done, [true, false, true, false]);
});

test('invalid steps, missing dates and empty logs are ignored safely', () => {
  const loop = bookLoop(book([entry('2026-10-01', 'Skim'), { step: 'Read' }, null]));
  assert.equal(loop.xp, 0);
  assert.equal(loop.loops, 0);
  assert.equal(loop.nextStep, 'Read');
  assert.equal(loop.lastEntry, null);
  assert.equal(bookLoop().xp, 0);
});

test('levels climb with XP and report progress toward the next', () => {
  assert.equal(levelFor(0).title, 'Novice');
  assert.equal(levelFor(59).level, 1);
  assert.equal(levelFor(60).title, 'Apprentice');
  assert.equal(levelFor(105).progress, 0.5);
  assert.equal(levelFor(105).toNext, 45);
  assert.equal(levelFor(9999).title, 'Master');
  assert.equal(levelFor(9999).next, null);
});

test('streaks count consecutive days and survive until today is over', () => {
  const days = new Map([['2026-10-10', 1], ['2026-10-11', 2], ['2026-10-12', 1], ['2026-10-08', 1]]);
  assert.equal(streak(days, '2026-10-12'), 3, 'today counts');
  assert.equal(streak(days, '2026-10-13'), 3, 'nothing yet today: yesterday keeps it alive');
  assert.equal(streak(days, '2026-10-14'), 0, 'a missed day breaks it');
  assert.equal(streak(new Map(), '2026-10-12'), 0);
});

test('activity days merge study logs and every published note', () => {
  const days = activityDays([book([entry('2026-10-12', 'Read'), entry('2026-10-12', 'Note')])], [{ publishedAt: '2026-10-11' }]);
  assert.equal(days.get('2026-10-12'), 2);
  assert.equal(days.get('2026-10-11'), 1);
});

test('the heatmap is Monday-first, ends today, and sums the current week', () => {
  const days = new Map([['2026-10-12', 3], ['2026-10-05', 1]]);
  const cells = heatmap(days, '2026-10-14', 2); // a Wednesday
  assert.equal(cells[0].day, '2026-10-05', 'starts on the Monday two weeks back');
  assert.equal(cells.at(-1).day, '2026-10-14');
  assert.equal(cells.length, 10);
  assert.equal(sessionsThisWeek(days, '2026-10-14'), 3);
});

test('local days honour the visitor time zone', () => {
  assert.equal(localDay('2026-10-12T02:00:00Z', 240), '2026-10-11', '10pm Eastern the evening before');
  assert.equal(localDay('2026-10-12'), '2026-10-12');
  assert.equal(localDay('nonsense'), '');
});

test('progress since the last visit reports XP, loops and level-ups', () => {
  const gains = progressSince(
    { a: { title: 'A', xp: 40, loops: 0, level: 1 }, b: { title: 'B', xp: 10, loops: 0, level: 1 } },
    { a: { title: 'A', xp: 90, loops: 1, level: 2 }, b: { title: 'B', xp: 10, loops: 0, level: 1 }, c: { title: 'C', xp: 20, loops: 0, level: 1 } },
  );
  assert.deepEqual(gains, [{ slug: 'a', title: 'A', xp: 50, loops: 1, levelUp: 2, quizzes: 0, lastQuiz: null }], 'unchanged and first-seen books are not rewards');
});

test('quizzes earn XP by score and keep the streak, but never close a loop', () => {
  assert.equal(quizXp(8, 10), 21);
  assert.equal(quizXp(10, 10), 25);
  assert.equal(quizXp(0, 10), 5);
  assert.equal(quizXp(12, 10), 25, 'scores above the total are capped');
  assert.equal(quizXp(undefined, undefined), 5, 'a quiz without a score still counts as taken');
  const loop = bookLoop(book([
    entry('2026-10-01', 'Read'),
    entry('2026-10-02', 'Quiz', { score: 6, total: 10, entry: 'Missed the regression questions.' }),
    entry('2026-10-04', 'Quiz', { score: 9, total: 10 }),
  ]));
  assert.equal(loop.loops, 0);
  assert.deepEqual(loop.done, [true, false, false, false], 'quizzes are not loop steps');
  assert.equal(loop.nextStep, 'Paraphrase');
  assert.equal(loop.xp, 10 + quizXp(6, 10) + quizXp(9, 10));
  assert.equal(loop.counts.Quiz, 2);
  assert.equal(loop.quiz.taken, 2);
  assert.equal(loop.quiz.last.score, 9);
  assert.equal(loop.quiz.best, 0.9);
  assert.ok(Math.abs(loop.quiz.trend - 0.3) < 1e-9, 'up 30 points on the previous quiz');
  const days = activityDays([book([entry('2026-10-04', 'Quiz', { score: 1, total: 2 })])]);
  assert.equal(days.get('2026-10-04'), 1);
  assert.equal(bookLoop(book([entry('2026-10-01', 'Read')])).quiz, null);
});

test('a streak is dealt as cards: ranks climb, suits change every thirteen days, the joker caps it', () => {
  const label = (card) => card.rank + card.suit;
  assert.equal(label(streakCard(1)), 'A♠');
  assert.equal(label(streakCard(13)), 'K♠');
  assert.equal(label(streakCard(14)), 'A♥');
  assert.equal(streakCard(14).red, true);
  assert.equal(label(streakCard(52)), 'K♦');
  assert.equal(streakCard(53).joker, true);
  assert.deepEqual(streakHand(0), []);
  assert.deepEqual(streakHand(1).map(label), ['A♠']);
  assert.deepEqual(streakHand(3).map(label), ['A♠', '2♠', '3♠']);
  assert.deepEqual(streakHand(15).map(label), ['J♠', 'Q♠', 'K♠', 'A♥', '2♥']);
  assert.deepEqual(streakHand(400).map(label), ['10♦', 'J♦', 'Q♦', 'K♦', 'JOKER'], 'one joker, however long the streak');
});
