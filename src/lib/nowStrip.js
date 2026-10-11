// The homepage "right now" line, derived from what is already in Sanity:
// what is being read or studied, and the latest note or musing.
const LEARNING = new Set(["Currently Learning", "In Progress"]);
const STUDY_TYPES = new Set(["Certification", "Course"]);

function byPriority(left, right) {
  if (Boolean(right.featured) !== Boolean(left.featured)) return right.featured ? 1 : -1;
  return (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999);
}

export function buildNowItems({ resources = [], notes = [], articles = [] } = {}, limit = 3) {
  const active = (resources ?? []).filter((item) => item && LEARNING.has(item.status) && item.slug).sort(byPriority);
  const reading = active.find((item) => !STUDY_TYPES.has(item.resourceType));
  const studying = active.find((item) => STUDY_TYPES.has(item.resourceType));
  const note = (notes ?? []).find((item) => item?.slug);
  const article = (articles ?? []).find((item) => item?.slug);
  const items = [];
  if (reading) {
    const progress = Number(reading.progress) || 0;
    items.push({ label: "Reading", title: reading.title, meta: progress > 0 ? `${progress}%` : "", href: `/library/${encodeURIComponent(reading.slug)}` });
  }
  if (studying) items.push({ label: "Studying", title: studying.title, meta: "", href: `/library/${encodeURIComponent(studying.slug)}` });
  if (note) items.push({ label: "Latest note", title: note.title, meta: note.displayDate || "", href: `/notes/${encodeURIComponent(note.slug)}` });
  if (article) items.push({ label: "Latest musing", title: article.title, meta: article.displayDate || "", href: `/writing/${encodeURIComponent(article.slug)}` });
  return items.slice(0, limit);
}
