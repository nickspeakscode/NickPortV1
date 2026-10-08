// Homepage highlights: most viewed first. Featured posts, then the newest,
// break ties (including before any views have been counted).
export function selectHighlights(source = [], limit = 3) {
  return [...source]
    .sort((left, right) => {
      const views = (Number(right.views) || 0) - (Number(left.views) || 0);
      if (views) return views;
      if (Boolean(right.featured) !== Boolean(left.featured)) return right.featured ? 1 : -1;
      return (Date.parse(right.publishedAt) || 0) - (Date.parse(left.publishedAt) || 0);
    })
    .slice(0, limit);
}
