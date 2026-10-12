import { escapeHtml } from "./sanity.js";
import { STEPS, STEP_XP, activityDays, bookLoop, heatmap, localDay, sessionsThisWeek, streak } from "./learningLoop.js";

const STEP_HINT = {
  Read: "Take in new material",
  Paraphrase: "Put it in your own words",
  Note: "Capture what matters",
  Apply: "Use it for something real",
};

function formatDay(day) {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? day : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function relativeDay(day, today = localDay(new Date().toISOString())) {
  if (!day) return "";
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff} days ago`;
  return formatDay(day);
}

// Four arcs around a centre readout; done steps glow in their own colour.
export function renderLoopRing(loop, { size = 132 } = {}) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const quarter = circumference / 4;
  const gap = 7;
  const arcs = STEPS.map((step, index) => {
    const state = loop.done[index] ? "done" : step === loop.nextStep ? "next" : "todo";
    return `<circle class="loop-arc" data-step="${step}" data-state="${state}" cx="60" cy="60" r="${radius}"
      stroke-dasharray="${(quarter - gap).toFixed(2)} ${(circumference - quarter + gap).toFixed(2)}"
      stroke-dashoffset="${(-index * quarter - gap / 2).toFixed(2)}" />`;
  }).join("");
  const doneCount = loop.done.filter(Boolean).length;
  return `
    <div class="loop-ring" style="--ring-size: ${size}px">
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g transform="rotate(-90 60 60)">${arcs}</g></svg>
      <div class="loop-ring-centre">
        <span class="loop-ring-label">Loop ${loop.loops + 1}</span>
        <strong>${doneCount}<small>/4</small></strong>
      </div>
    </div>`;
}

export function renderLoopSteps(loop) {
  return `<ol class="loop-steps">${STEPS.map((step, index) => {
    const state = loop.done[index] ? "done" : step === loop.nextStep ? "next" : "todo";
    return `<li data-step="${step}" data-state="${state}">
      <span class="loop-step-dot" aria-hidden="true"></span>
      <span class="loop-step-name">${step}</span>
      <span class="loop-step-meta">${state === "done" ? "Done" : state === "next" ? "Up next" : `+${STEP_XP[step]} XP`}</span>
      <span class="visually-hidden">${state === "done" ? "done this loop" : state === "next" ? "next step" : "not yet"}</span>
    </li>`;
  }).join("")}</ol>`;
}

export function renderMastery(loop) {
  const { level } = loop;
  const width = Math.round(level.progress * 100);
  return `
    <div class="mastery" role="img" aria-label="Mastery level ${level.level}, ${escapeHtml(level.title)}, ${loop.xp} XP${level.next ? `, ${level.toNext} XP to ${escapeHtml(level.next.title)}` : ""}">
      <div class="mastery-head">
        <span class="mastery-level">Lv ${level.level}</span>
        <span class="mastery-title">${escapeHtml(level.title)}</span>
        <span class="mastery-xp">${loop.xp} XP</span>
      </div>
      <div class="mastery-bar" aria-hidden="true"><span style="--fill: ${width}%"></span></div>
      <p class="mastery-next" aria-hidden="true">${level.next ? `${level.toNext} XP to ${escapeHtml(level.next.title)}` : "Max level"}</p>
    </div>`;
}

export function renderStudyLog(entries, { limit = 0 } = {}) {
  const items = [...entries].reverse();
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return `<p class="index-empty">No study sessions logged yet.</p>`;
  return `<ol class="study-log">${shown.map((entry) => `
    <li data-step="${entry.step}">
      <div class="study-log-head">
        <span class="study-log-step">${escapeHtml(entry.step)}</span>
        ${entry.where ? `<span class="study-log-where">${escapeHtml(entry.where)}</span>` : ""}
        <time datetime="${escapeHtml(entry.day)}">${escapeHtml(formatDay(entry.day))}</time>
      </div>
      ${entry.text ? (entry.href
        ? `<a class="study-log-text" href="${escapeHtml(entry.href)}">${escapeHtml(entry.text)} <span aria-hidden="true">→</span></a>`
        : `<p class="study-log-text">${escapeHtml(entry.text)}</p>`) : ""}
    </li>`).join("")}</ol>`;
}

// The reader page and detail-page section for one book.
export function renderLoopPanel(loop, { heading = "Learning loop", headingTag = "h2", headingClass = "reader-heading" } = {}) {
  const next = loop.nextStep;
  return `
    <div class="loop-panel">
      <${headingTag} class="${headingClass}">${escapeHtml(heading)}</${headingTag}>
      <div class="loop-panel-grid">
        ${renderLoopRing(loop)}
        ${renderLoopSteps(loop)}
      </div>
      <p class="loop-next" data-step="${escapeHtml(next)}"><span>Next step</span> <strong>${escapeHtml(next)}</strong> ${escapeHtml(STEP_HINT[next].toLowerCase())}</p>
      ${renderMastery(loop)}
    </div>`;
}

// Compact pips for a shelf caption: only for books with a loop under way.
export function renderShelfLoop(loop) {
  if (!loop.entries.length) return "";
  return `<span class="shelf-loop" title="${escapeHtml(`Loop ${loop.loops + 1}: ${loop.done.filter(Boolean).length} of 4 steps · Lv ${loop.level.level} ${loop.level.title}`)}">
    <span class="shelf-loop-pips" aria-hidden="true">${STEPS.map((step, index) => `<i data-step="${step}"${loop.done[index] ? ' class="is-done"' : ""}></i>`).join("")}</span>
    <span class="shelf-loop-level">Lv ${loop.level.level}</span>
    <span class="visually-hidden">Loop ${loop.loops + 1}: ${loop.done.filter(Boolean).length} of 4 steps done, level ${loop.level.level} ${escapeHtml(loop.level.title)}</span>
  </span>`;
}

// The study HUD at the top of the Library: streak, week, loops, 12 weeks.
export function renderStudyHud(resources = [], notes = [], today = localDay(new Date().toISOString())) {
  const days = activityDays(resources, notes);
  if (!days.size) return "";
  const loops = resources.reduce((sum, resource) => sum + bookLoop(resource, notes).loops, 0);
  const cells = heatmap(days, today, 12);
  const level = (count) => (count >= 3 ? 3 : count);
  const current = streak(days, today);
  const week = sessionsThisWeek(days, today);
  return `
    <section class="study-hud" aria-label="Study activity">
      <div class="study-hud-stats">
        <div class="study-hud-stat${current ? " is-live" : ""}"><span>Streak</span><strong>${current}</strong><em>${current === 1 ? "day" : "days"}</em></div>
        <div class="study-hud-stat"><span>This week</span><strong>${week}</strong><em>${week === 1 ? "session" : "sessions"}</em></div>
        <div class="study-hud-stat"><span>Loops closed</span><strong>${loops}</strong><em>all time</em></div>
      </div>
      <div class="study-hud-map">
        <div class="study-hud-grid" role="img" aria-label="${days.size} active days in the last 12 weeks">
          ${cells.map((cell) => `<i data-level="${level(cell.count)}"${cell.day === today ? ' class="is-today"' : ""} title="${escapeHtml(`${formatDay(cell.day)}: ${cell.count} ${cell.count === 1 ? "session" : "sessions"}`)}"></i>`).join("")}
        </div>
        <p class="study-hud-caption" aria-hidden="true"><span>12 weeks</span><span class="study-hud-scale">Less <i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i> More</span></p>
      </div>
    </section>`;
}

export function renderGainToast(gains) {
  const total = gains.reduce((sum, gain) => sum + gain.xp, 0);
  const lines = gains.slice(0, 3).map((gain) => {
    const extras = [gain.loops ? `${gain.loops === 1 ? "Loop" : `${gain.loops} loops`} closed` : "", gain.levelUp ? `Level ${gain.levelUp}` : ""].filter(Boolean);
    return `<li><strong>${escapeHtml(gain.title)}</strong><span>+${gain.xp} XP${extras.length ? ` · ${escapeHtml(extras.join(" · "))}` : ""}</span></li>`;
  }).join("");
  return `
    <div class="gain-toast" role="status">
      <p class="gain-toast-kicker">Since your last visit</p>
      <p class="gain-toast-total">+<span data-count="${total}">${total}</span> XP</p>
      <ul>${lines}</ul>
      <button type="button" class="gain-toast-close" aria-label="Dismiss">×</button>
    </div>`;
}
