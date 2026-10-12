// The homepage "right now" card, derived from what is already in Sanity:
// what is being read or studied, and the latest note or musing.
const LEARNING = new Set(["Currently Learning", "In Progress"]);
const STUDY_TYPES = new Set(["Certification", "Course"]);
const VERBS = { Video: "Watching", Podcast: "Listening to" };

function byPriority(left, right) {
  if (Boolean(right.featured) !== Boolean(left.featured)) return right.featured ? 1 : -1;
  return (left.displayOrder ?? 9999) - (right.displayOrder ?? 9999);
}

function learningItem(resource, label) {
  const progress = Number(resource.progress) || 0;
  return {
    kind: "learning",
    label,
    title: resource.title,
    meta: progress > 0 ? `${progress}%` : "",
    progress,
    cover: resource.coverImage || "",
    slug: resource.slug,
    href: `/library/${encodeURIComponent(resource.slug)}`,
  };
}

export function buildNowItems({ resources = [], notes = [], articles = [] } = {}, limit = 3) {
  // Own work in progress is not something being learned from.
  const active = (resources ?? [])
    .filter((item) => item && LEARNING.has(item.status) && item.slug && !item.createdByMe)
    .sort(byPriority);
  const reading = active.find((item) => !STUDY_TYPES.has(item.resourceType));
  const studying = active.find((item) => STUDY_TYPES.has(item.resourceType));
  const note = (notes ?? []).find((item) => item?.slug);
  const article = (articles ?? []).find((item) => item?.slug);
  const items = [];
  if (reading) items.push(learningItem(reading, VERBS[reading.resourceType] ?? "Reading"));
  if (studying) items.push(learningItem(studying, "Studying"));
  if (note) items.push({ kind: "note", label: "Latest note", title: note.title, meta: note.displayDate || "", href: `/notes/${encodeURIComponent(note.slug)}` });
  if (article) items.push({ kind: "musing", label: "Latest musing", title: article.title, meta: article.displayDate || "", href: `/writing/${encodeURIComponent(article.slug)}` });
  return items.slice(0, limit);
}
