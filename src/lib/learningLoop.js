// The study loop: Read -> Paraphrase -> Note -> Apply -> repeat.
// Everything here is derived from a book's study log in Sanity, plus any
// Today I Learned notes linked to that book (which count as Note steps).

export const STEPS = ["Read", "Paraphrase", "Note", "Apply"];
// A quiz is retrieval practice: it earns XP and keeps the streak, but it is
// not one of the four loop steps.
export const QUIZ = "Quiz";
const LOGGABLE = [...STEPS, QUIZ];
const ORDER = [...STEPS, QUIZ];

// 5 XP for taking it, up to 20 more for the score.
export function quizXp(score, total) {
  const ratio = quizRatio(score, total);
  return ratio === null ? 5 : 5 + Math.round(20 * ratio);
}

export function quizRatio(score, total) {
  const s = Number(score);
  const t = Number(total);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0 || s < 0) return null;
  return Math.min(1, s / t);
}
export const STEP_XP = { Read: 10, Paraphrase: 15, Note: 15, Apply: 25 };
export const LOOP_BONUS = 25;
export const LEVELS = [
  { level: 1, title: "Novice", xp: 0 },
  { level: 2, title: "Apprentice", xp: 60 },
  { level: 3, title: "Practitioner", xp: 150 },
  { level: 4, title: "Adept", xp: 280 },
  { level: 5, title: "Master", xp: 450 },
];

const DAY = 86400000;

// Calendar dates (YYYY-MM-DD) in the visitor's local time zone.
export function localDay(value, timeZoneOffsetMinutes) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const offset = timeZoneOffsetMinutes ?? new Date(time).getTimezoneOffset();
  return new Date(time - offset * 60000).toISOString().slice(0, 10);
}

function dayNumber(day) {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY);
}

// One ordered list of steps for a book: its own log plus linked notes.
export function bookEntries(resource = {}, notes = []) {
  const log = (resource.studyLog ?? [])
    .filter((entry) => entry && LOGGABLE.includes(entry.step) && localDay(entry.date))
    .map((entry) => ({
      key: entry._key || `${entry.date}-${entry.step}`,
      step: entry.step,
      day: localDay(entry.date),
      where: entry.where || "",
      minutes: Number(entry.minutes) || 0,
      text: entry.entry || "",
      ...(entry.step === QUIZ ? { score: Number(entry.score), total: Number(entry.total), ratio: quizRatio(entry.score, entry.total) } : {}),
    }));
  const linked = (notes ?? [])
    .filter((note) => note?.resourceSlug && note.resourceSlug === resource.slug && localDay(note.publishedAt))
    .map((note) => ({
      key: `note-${note.slug}`,
      step: "Note",
      day: localDay(note.publishedAt),
      where: "",
      minutes: 0,
      text: note.title || "",
      href: `/notes/${encodeURIComponent(note.slug)}`,
    }));
  return [...log, ...linked].sort((a, b) => (a.day === b.day ? ORDER.indexOf(a.step) - ORDER.indexOf(b.step) : a.day < b.day ? -1 : 1));
}

export function levelFor(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.xp) current = level;
  const next = LEVELS.find((level) => level.xp > xp) ?? null;
  const span = next ? next.xp - current.xp : 1;
  return {
    ...current,
    next,
    progress: next ? Math.min(1, (xp - current.xp) / span) : 1,
    toNext: next ? next.xp - xp : 0,
  };
}

// Walks the entries in order. A loop closes once all four steps have been
// done since the previous loop closed; the order inside a loop is free.
export function bookLoop(resource = {}, notes = []) {
  const entries = bookEntries(resource, notes);
  let xp = 0;
  let loops = 0;
  let current = new Set();
  for (const entry of entries) {
    if (entry.step === QUIZ) {
      xp += quizXp(entry.score, entry.total);
      continue;
    }
    xp += STEP_XP[entry.step];
    current.add(entry.step);
    if (current.size === STEPS.length) {
      loops += 1;
      xp += LOOP_BONUS;
      current = new Set();
    }
  }
  const done = STEPS.map((step) => current.has(step));
  const nextStep = STEPS.find((step) => !current.has(step));
  return {
    entries,
    xp,
    loops,
    done,
    nextStep,
    level: levelFor(xp),
    lastEntry: entries[entries.length - 1] ?? null,
    counts: Object.fromEntries(LOGGABLE.map((step) => [step, entries.filter((entry) => entry.step === step).length])),
    quiz: quizStats(entries),
  };
}

// Recall over time for one book, from its Quiz entries.
export function quizStats(entries = []) {
  const quizzes = entries.filter((entry) => entry.step === QUIZ && entry.ratio !== null && entry.ratio !== undefined);
  if (!quizzes.length) return null;
  const last = quizzes[quizzes.length - 1];
  const recent = quizzes.slice(-3);
  return {
    taken: quizzes.length,
    last,
    best: Math.max(...quizzes.map((quiz) => quiz.ratio)),
    average: recent.reduce((sum, quiz) => sum + quiz.ratio, 0) / recent.length,
    history: quizzes.slice(-8).map((quiz) => ({ day: quiz.day, ratio: quiz.ratio, score: quiz.score, total: quiz.total })),
    trend: quizzes.length > 1 ? last.ratio - quizzes[quizzes.length - 2].ratio : 0,
  };
}

// Days with any study activity, across every book and every note.
export function activityDays(resources = [], notes = []) {
  const counts = new Map();
  const add = (day) => { if (day) counts.set(day, (counts.get(day) ?? 0) + 1); };
  for (const resource of resources ?? []) for (const entry of resource?.studyLog ?? []) if (LOGGABLE.includes(entry?.step)) add(localDay(entry.date));
  for (const note of notes ?? []) add(localDay(note?.publishedAt));
  return counts;
}

// The streak stays alive through today: it counts back from today, or from
// yesterday when nothing has been logged yet today.
export function streak(days, today = localDay(new Date().toISOString())) {
  if (!days?.size || !today) return 0;
  let cursor = dayNumber(today);
  const has = (number) => days.has(new Date(number * DAY).toISOString().slice(0, 10));
  if (!has(cursor)) cursor -= 1;
  let count = 0;
  while (has(cursor)) { count += 1; cursor -= 1; }
  return count;
}

// The last `weeks` weeks, Monday-first columns, ending with today's week.
export function heatmap(days, today = localDay(new Date().toISOString()), weeks = 12) {
  const end = dayNumber(today);
  const weekday = (new Date(end * DAY).getUTCDay() + 6) % 7;
  const start = end - weekday - (weeks - 1) * 7;
  const cells = [];
  for (let number = start; number <= end; number += 1) {
    const day = new Date(number * DAY).toISOString().slice(0, 10);
    cells.push({ day, count: days?.get(day) ?? 0 });
  }
  return cells;
}

export function sessionsThisWeek(days, today = localDay(new Date().toISOString())) {
  const cells = heatmap(days, today, 1);
  return cells.reduce((sum, cell) => sum + cell.count, 0);
}

// What changed since the visitor's last look, for the reward moment.
export function progressSince(previous = {}, current = {}) {
  const gains = [];
  for (const [slug, now] of Object.entries(current)) {
    const before = previous[slug];
    if (!before) continue;
    const xp = now.xp - before.xp;
    if (xp <= 0) continue;
    gains.push({
      slug,
      title: now.title,
      xp,
      loops: Math.max(0, now.loops - before.loops),
      levelUp: now.level > before.level ? now.level : 0,
      quizzes: Math.max(0, (now.quizzes ?? 0) - (before.quizzes ?? 0)),
      lastQuiz: now.lastQuiz ?? null,
    });
  }
  return gains.sort((a, b) => b.xp - a.xp);
}
