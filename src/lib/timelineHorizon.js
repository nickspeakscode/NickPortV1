// A distant point-cloud landscape. The camera approaches only with scroll;
// the foreground's final particle stream leads into this same destination.
export function createTimelineHorizon(canvas, chapters) {
  const context = canvas.getContext('2d');
  const ridges = [
    [[-1, .08], [-.78, .27], [-.63, .15], [-.4, .8], [-.14, .3], [.08, .47], [.29, .2], [.5, .72], [.77, .33], [1, .04]],
    [[-1, .01], [-.74, .22], [-.5, .08], [-.15, .7], [.13, .19], [.43, .53], [.74, .12], [1, .02]],
  ];
  const sample = (points, x) => {
    const index = points.findIndex(point => point[0] >= x);
    if (index <= 0) return points[Math.max(0, index)][1];
    const a = points[index - 1], b = points[index];
    return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  };
  const landscape = document.createElement('canvas');
  const landscapeContext = landscape.getContext('2d');
  let width = 1, height = 1, previous = -1, ratio = 1;
  let lastTime = 0, driftPhase = 0;
  let cachedLandscape = false, cachedLight = false;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    previous = -1;
    cachedLandscape = false;
    lastTime = 0;
  }
  function draw(progress, now, reducedMotion) {
    const light = document.documentElement.dataset.timelineTheme === 'light';
    const stacked = width <= 900 && height > 520;
    const centerX = width * .5;
    const baseY = height * (stacked ? .2 + progress * .11 : .31);
    const zoom = .55 + progress * progress * .85;
    const span = Math.min(width * (stacked ? .4 : .24), 390) * zoom;
    const elevation = Math.min(height * (stacked ? .1 : .16), width * .23) * zoom;
    const destination = { x: centerX, y: baseY - elevation * .12 };
    const arrival = Math.max(0, Math.min(1, (progress - .88) / .12));
    // Add motion to the existing scroll phase instead of replacing it at
    // arrival. A suspended tab contributes at most one small visible step.
    const elapsed = lastTime ? Math.max(0, Math.min(50, now - lastTime)) : 0;
    lastTime = now;
    if (!reducedMotion) driftPhase = (driftPhase + elapsed * arrival / 19000) % 1;
    if (!context || (previous === progress && (!arrival || reducedMotion))) return destination;
    previous = progress;
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.rect(0, stacked ? 122 : 65, width, height);
    context.clip();
    const dot = (x, y, size) => { context.moveTo(x + size, y); context.arc(x, y, size, 0, Math.PI * 2); };
    // A visible timeline in perspective: upcoming stops move nearer as the
    // camera advances. At the end the single path opens into three futures.
    const vanishingY = baseY + elevation * .24;
    const nearY = height * .97;
    context.fillStyle = light ? '#356e66' : '#95c0bd';
    for (let branch = -1; branch <= 1; branch++) {
      if (!arrival && branch) continue;
      context.globalAlpha = branch ? arrival * .42 : .5;
      context.beginPath();
      for (let i = 0; i < 88; i++) {
        const q = (i / 88 + progress * .37 - driftPhase + 1) % 1;
        const depth = q * q;
        const x = centerX + branch * width * .19 * (1 - depth) * arrival;
        dot(x, vanishingY + (nearY - vanishingY) * depth, .38 + depth * .72);
      }
      context.fill();
    }
    const chapterPosition = progress * (chapters.length - 1);
    if (arrival < 1) for (let index = Math.ceil(chapterPosition); index < Math.min(chapters.length, chapterPosition + 5); index++) {
      const depth = 1 / (1 + (index - chapterPosition) * 1.5);
      const y = vanishingY + height * .36 * depth;
      context.globalAlpha = depth * .45 * (1 - arrival);
      context.beginPath();
      // Keep labels in the quiet lane left of the path. Alternating right
      // placed some labels directly underneath the foreground illustration.
      const side = -1;
      for (let d = 0; d < 60 * depth; d += 5) dot(centerX + side * d, y, .6);
      context.fill();
      if (!stacked && width > 1100) {
        context.font = `${Math.max(8, 11 * depth)}px sans-serif`;
        context.textAlign = 'right';
        context.fillText(`${chapters[index].rank} ♠  ${chapters[index].label}`, centerX + side * (60 * depth + 8), y + 3);
      }
    }
    function drawLandscape(painter) {
      painter.save();
      const point = (x, y, size) => { painter.moveTo(x + size, y); painter.arc(x, y, size, 0, Math.PI * 2); };
      painter.globalAlpha = 1;
      // The sun is dots too, with its lower edge disappearing behind the ridge.
      const sunRadius = 31 * zoom;
      const sunX = centerX + span * .15;
      const sunY = Math.max((stacked ? 122 : 65) + sunRadius + 8, baseY - elevation * .8);
      const halo = painter.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 3.6);
      halo.addColorStop(0, light ? '#c5a76d16' : '#bd95641c');
      halo.addColorStop(1, '#bd956400');
      painter.fillStyle = halo; painter.fillRect(sunX - sunRadius * 4, sunY - sunRadius * 4, sunRadius * 8, sunRadius * 8);
      painter.fillStyle = light ? '#9d713e' : '#d2b789';
      painter.globalAlpha = .65;
      painter.beginPath();
      for (let i = 0; i < 420; i++) {
        const radius = Math.sqrt((i + .5) / 420) * sunRadius, angle = i * 2.399963;
        const px = sunX + Math.cos(angle) * radius;
        const py = sunY + Math.sin(angle) * radius;
        if (py < baseY - sample(ridges[0], (px - centerX) / span) * elevation) point(px, py, .6 + progress * .2);
      }
      painter.fill();
      ridges.forEach((ridge, layer) => {
        painter.fillStyle = light ? (layer ? '#447c72' : '#748e8e') : (layer ? '#80b5aa' : '#537f88');
        painter.globalAlpha = .35 + progress * .3;
        painter.beginPath();
        for (let row = 0; row <= 16; row++) for (let col = 0; col <= 120; col++) {
          const x = -1 + col / 60, depth = row / 16;
          const jitter = Math.sin(col * 12.37 + row * 7.13) * .008;
          const terrain = sample(ridge, x) + Math.sin(x * 43 + row * .6) * .012;
          const y = baseY + layer * elevation * .15 - terrain * elevation * (1 - depth) + jitter * elevation;
          point(centerX + (x + jitter) * span * (1 + layer * .1 - depth * .12), y, (.65 + zoom * .25) * (1 - depth * .55));
        }
        painter.fill();
      });
      painter.restore();
    }
    // At the final stop only the journey lines move. Reuse the static sun
    // and mountain layer rather than resampling 4,000 ridge dots each frame.
    if (progress === 1 && landscapeContext) {
      if (!cachedLandscape || cachedLight !== light) {
        landscape.width = canvas.width; landscape.height = canvas.height;
        landscapeContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawLandscape(landscapeContext);
        cachedLandscape = true; cachedLight = light;
      }
      context.globalAlpha = 1;
      context.drawImage(landscape, 0, 0, width, height);
    } else drawLandscape(context);
    context.restore();
    return destination;
  }
  resize();
  return { resize, draw };
}
