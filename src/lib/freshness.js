// A Library item counts as new for two weeks after it is created in Sanity.
export const NEW_ITEM_DAYS = 14;

export function isRecent(createdAt, now = Date.now(), days = NEW_ITEM_DAYS) {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  return age >= 0 && age < days * 86400000;
}
