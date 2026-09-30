import { timelineArt } from './timelineArt.js';

type Point = { x: number; y: number; z: number; tone: number };
type Chapter = { motif: keyof typeof timelineArt };
type Position = { x: number; y: number };
type Cloud = { points: Point[] | null; route: Float32Array | null };

// Fixed-size point clouds morph along a continuous, reversible journey. Image
// pixels are sampled offscreen; only dots are ever drawn to the visible canvas.
export function createTimelineParticles(canvas: HTMLCanvasElement, chapters: Chapter[], onReady: () => void) {
  const context = canvas.getContext('2d');
  const count = 3500;
  const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  let palette: string[] = [];
  function refreshTheme() {
    const light = document.documentElement.dataset.timelineTheme === 'light';
    palette = light ? ['#9bbdb7', '#7aa69e', '#578f86', '#397f72', '#176b59', '#09543f', '#08705a']
      : ['#365f70', '#4d7b88', '#6e9da5', '#89b8b6', '#aad2c7', '#c6e4d8', '#5dffd0'];
  }
  // Spatial ordering keeps nearby dots together during a shape change.
  const spatialKey = (x: number, y: number) => {
    let key = 0;
    for (let bit = 0; bit < 7; bit++) key |= ((x >> bit) & 1) << (bit * 2) | ((y >> bit) & 1) << (bit * 2 + 1);
    return key;
  };
  function fallbackPoints(motif: Chapter['motif']): Point[] {
    // Keep a locally generated illustration available even if an asset is
    // blocked or cannot be sampled. Sumlino retains its recognizable S shape.
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963;
      const thickness = Math.sin(index * 1.73) * .085;
      if (motif === 'sumlino') {
        const lower = index >= count / 2;
        const t = (index % (count / 2)) / (count / 2 - 1), u = 1 - t;
        const x = lower ? 3 * u * u * t * .75 + 3 * u * t * t * .5 - t * t * t * .55
          : u * u * u * .55 - 3 * u * u * t * .5 - 3 * u * t * t * .75;
        const y = lower ? 3 * u * u * t * .05 + 3 * u * t * t + t * t * t * .6
          : -u * u * u * .6 - 3 * u * u * t - 3 * u * t * t * .05;
        return { x: x + Math.cos(angle) * .095, y: y + Math.sin(angle) * .095, z: thickness, tone: 4 };
      }
      const radius = .62 + thickness;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: Math.sin(index * .37) * .12, tone: 3.8 };
    });
  }
  const ringFallback = fallbackPoints('graduation');
  const clouds = chapters.map(chapter => {
    const cloud: Cloud = { points: chapter.motif === 'sumlino' ? fallbackPoints('sumlino') : ringFallback, route: null };
    if (chapter.motif === 'basketball') {
      cloud.points = Array.from({ length: count }, (_, i) => {
        const y = 1 - 2 * (i + .5) / count, r = Math.sqrt(1 - y * y), angle = i * 2.399963;
        const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
        const seam = Math.abs(y) < .035 || Math.abs(x) < .035 || Math.abs(z - .5 * Math.sin(y * Math.PI)) < .035;
        return { x: x * .77, y: y * .77, z: z * .77, tone: seam ? 0 : 3.5 + z * 1.4 };
      });
      return cloud;
    }
    const image = new Image();
    image.onload = () => {
      try {
        const texture = document.createElement('canvas');
        texture.width = texture.height = 320;
        const painter = texture.getContext('2d', { willReadFrequently: true });
        if (!painter) return;
        painter.drawImage(image, 0, 0, 320, 320);
        const pixels = painter.getImageData(0, 0, 320, 320).data;
        const samples: Array<{ x: number; y: number; tone: number; key: number }> = [];
        for (let y = 2; y < 320; y += 4) for (let x = 2; x < 320; x += 4) {
          const i = (y * 320 + x) * 4;
          const [r, g, b, alpha] = pixels.subarray(i, i + 4);
          const brightness = r * 0.21 + g * 0.72 + b * 0.07;
          // Sumlino's blue silhouette becomes a point cloud, without its white
          // background or a visible logo image. Its eye cutouts remain empty.
          const include = chapter.motif === 'sumlino' ? b > g * 1.3 && r < 115 && b > 120 : alpha > 100 && brightness > 80;
          if (include) samples.push({ x: x - 160, y: y - 160, tone: chapter.motif === 'sumlino' ? 3.5 + g / 170 : clamp((brightness - 62) / 32, 0, 5), key: spatialKey(x >> 2, y >> 2) });
        }
        samples.sort((a, b) => a.key - b.key);
        if (samples.length) cloud.points = Array.from({ length: count }, (_, index) => {
          const point = samples[Math.floor(index * samples.length / count)];
          const angle = index * 2.399963;
          const jitter = samples.length < count ? 1.35 : 0.45;
          return { x: (point.x + Math.cos(angle) * jitter) / 160, y: (point.y + Math.sin(angle) * jitter) / 160, z: Math.sin(index * 1.73) * .13, tone: point.tone };
        });
      } catch {
        // A decoding/security/read failure keeps the local fallback intact.
      } finally {
        cloud.route = null;
        onReady?.();
      }
    };
    image.onerror = () => { cloud.route = null; onReady?.(); };
    const source = timelineArt[chapter.motif];
    image.src = source.startsWith('<svg') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}` : source;
    return cloud;
  });
  const offsetsX = new Float32Array(count);
  const offsetsY = new Float32Array(count);
  const velocitiesX = new Float32Array(count);
  const velocitiesY = new Float32Array(count);
  const seeds = Array.from({ length: count }, (_, i) => {
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 0.5) / count);
    return { x: Math.cos(angle), y: Math.sin(angle), fieldX: Math.cos(angle) * radius * 190, fieldY: Math.sin(angle) * radius * 175, size: 0.8 + (i % 7) / 18 };
  });
  // Route, projection and paint buffers are reused. Thousands of short-lived
  // objects per frame otherwise cause visible garbage-collection hitches.
  const depthLevels = 10;
  const bucketHeads = new Int32Array(7 * depthLevels);
  const nextDot = new Int32Array(count);
  const screenX = new Float32Array(count);
  const screenY = new Float32Array(count);
  const dotRadius = new Float32Array(count);
  function routeFor(index: number) {
    const cloud = clouds[index];
    if (cloud.route) return cloud.route;
    const route = new Float32Array(count * 3);
    const points = cloud.points!;
    for (let i = 0; i < count; i++) {
      const point = points[i], seed = seeds[i];
      const x = point.x * 160, y = point.y * 160;
      const px = clamp((x + 160) / 320), py = clamp((y + 160) / 320);
      let flowX = seed.fieldX, flowY = seed.fieldY, order = py;
      switch (chapters[index].motif) {
        case 'basketball': order = Math.hypot(x, y) / 160; break;
        case 'graduation': flowX = x * 1.55 + seed.x * 24; flowY = -145 + py * 40 + seed.y * 20; break;
        case 'crypto': flowX = (y < 0 ? -150 : 150) + seed.x * 25; flowY = y * .9 + seed.y * 40; order = y < 0 ? px * .5 : .5 + px * .5; break;
        case 'business': flowX = x + seed.x * 40; flowY = 150 + seed.y * 28; order = px * .65 + (1 - py) * .35; break;
        case 'finance': flowX = Math.round(x / 45) * 45 + seed.x * 25; flowY = -145 + seed.y * 45; break;
        case 'learning': flowX = Math.sign(x) * (140 + seed.x * 30); flowY = y * .8 + seed.y * 45; order = Math.abs(x) / 160; break;
        case 'markets': flowX = x; flowY = 155 + seed.y * 20; order = px * .55 + (1 - py) * .45; break;
        case 'sumlino': flowX = (y < 0 ? -1 : 1) * (155 + seed.x * 20); flowY = y + seed.y * 40; order = y < 0 ? px : 1 - px; break;
        case 'mountains': flowX = x * 1.5 + seed.x * 20; flowY = 135 + seed.y * 35; order = (1 - py) * .7 + px * .3; break;
      }
      route[i * 3] = flowX / 160;
      route[i * 3 + 1] = flowY / 160;
      route[i * 3 + 2] = clamp(order) * .18;
    }
    cloud.route = route;
    return route;
  }
  let width = 1, height = 1, scale = 1, left = 0, top = 0;
  let pointer: Position | null = null;
  let burst: (Position & { start: number }) | null = null;
  let leanX = 0, leanY = 0;
  let previousTime = 0;
  let animationTime = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    left = rect.left; top = rect.top;
    scale = Math.min(width / 340, height / 360);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    resetInteraction();
  }
  function setPointer(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    pointer = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      ? { x: clientX - rect.left - width / 2, y: clientY - rect.top - height / 2 } : null;
  }
  function clearPointer() { pointer = null; }
  function resetInteraction() {
    pointer = null; burst = null; previousTime = 0;
    leanX = leanY = 0;
    offsetsX.fill(0); offsetsY.fill(0); velocitiesX.fill(0); velocitiesY.fill(0);
  }
  function disperse(clientX?: number, clientY?: number) {
    const rect = canvas.getBoundingClientRect();
    burst = { start: performance.now(), x: typeof clientX === 'number' ? clientX - rect.left - width / 2 : 0, y: typeof clientY === 'number' ? clientY - rect.top - height / 2 : 0 };
    // A click has its own complete return, even if the cursor stays over it.
    pointer = null;
  }
  function draw(progress: number, reducedMotion: boolean, now = performance.now(), destination?: Position) {
    if (!context) return false;
    context.clearRect(0, 0, width, height);
    const position = clamp(reducedMotion ? Math.round(progress) : progress, 0, clouds.length - 1);
    const from = Math.floor(position), to = Math.min(from + 1, clouds.length - 1);
    const a = clouds[from].points, b = clouds[to].points;
    if (!a || !b) return false;
    const phase = position - from;
    const morph = smooth(phase);
    // Unmake the old object, travel as a free field, then gather the next one.
    // Both directions use the same path; reversing scroll never jumps shapes.
    const scatter = Math.pow(Math.sin(phase * Math.PI), 1.4);
    const arrival = reducedMotion ? 0 : smooth((position - (clouds.length - 1.35)) / .35);
    const elapsed = previousTime ? clamp(now - previousTime, 0, 50) : 0;
    const dt = elapsed / 16.67;
    previousTime = now;
    if (!reducedMotion) animationTime += elapsed;
    const radius = clamp(scale * 70, 70, 110);
    bucketHeads.fill(-1);
    if (reducedMotion) leanX = leanY = 0;
    const leanBlend = 1 - Math.exp(-dt / 7);
    leanX += ((pointer && !reducedMotion ? clamp(pointer.y / height, -.5, .5) * .55 : 0) - leanX) * leanBlend;
    leanY += ((pointer && !reducedMotion ? clamp(pointer.x / width, -.5, .5) * .7 : 0) - leanY) * leanBlend;
    if (reducedMotion) burst = null;
    const burstAge = burst ? (now - burst.start) / 1450 : 1;
    const burstStrength = burst ? smooth(burstAge / 0.18) * (1 - smooth((burstAge - 0.22) / 0.78)) : 0;
    if (burstAge >= 1) burst = null;
    let moving = Boolean(burst) || !reducedMotion;
    const visibleCount = innerWidth <= 900 ? 1800 : count;
    const route = routeFor(to);
    const motif = chapters[to].motif;
    const sphere = chapters[from].motif === 'basketball';
    const spin = sphere && !reducedMotion ? animationTime * Math.PI * 2 * .035 / 1000 : 0;
    const spinCos = Math.cos(spin), spinSin = Math.sin(spin);
    const idle = reducedMotion ? 0 : (1 - scatter) * (1 - arrival);
    const yaw = Math.sin(animationTime / 5300) * .32 * idle * (sphere ? morph : 1) + leanY;
    const pitch = Math.sin(animationTime / 7300) * .055 * idle - leanX;
    const yawCos = Math.cos(yaw), yawSin = Math.sin(yaw);
    const pitchCos = Math.cos(pitch), pitchSin = Math.sin(pitch);
    const float = Math.sin(animationTime / 5400) * 1.4 * scale * idle;
    const release = smooth(phase / .4);
    // Small fixed integration steps preserve the same spring at 30, 60 or
    // 120Hz, including a dropped frame, without a catch-up overshoot.
    const springSteps = Math.max(1, Math.ceil(dt));
    const springDt = dt / springSteps;
    const damping = Math.pow(.72, springDt);
    const baseRadius = clamp(scale * .85, .8, 1.4) * (1 - scatter * .2);
    for (let dotIndex = 0; dotIndex < visibleCount; dotIndex++) {
      const i = Math.floor(dotIndex * count / visibleCount);
      const seed = seeds[i];
      // Assemble the destination's parts in a meaningful order, instead of
      // morphing every chapter through the same cloud. All delays are driven
      // by the one reversible chapter progress value, never particle timers.
      let flowX = route[i * 3], flowY = route[i * 3 + 1];
      const point = b[i];
      if (motif === 'basketball') {
        const angle = Math.atan2(point.y, point.x) + (1 - phase) * 1.8;
        flowX = Math.cos(angle) * 170 / 160; flowY = Math.sin(angle) * 150 / 160;
      } else if (motif === 'markets') {
        flowX += Math.sin(point.y * 160 / 35 + phase * 3) * .2;
      }
      const delay = route[i * 3 + 2];
      const assemble = smooth((phase - .2 - delay) / (.8 - delay));
      const sourceX = a[i].x * spinCos + a[i].z * spinSin;
      const sourceZ = a[i].z * spinCos - a[i].x * spinSin;
      let worldX = mix(mix(sourceX, flowX, release), point.x, assemble);
      let worldY = mix(mix(a[i].y, flowY, release), point.y, assemble);
      let worldZ = mix(sourceZ, point.z, morph) + seed.x * scatter * .32;
      const rotatedX = worldX * yawCos + worldZ * yawSin;
      worldZ = worldZ * yawCos - worldX * yawSin;
      worldX = rotatedX;
      const rotatedY = worldY * pitchCos - worldZ * pitchSin;
      worldZ = worldY * pitchSin + worldZ * pitchCos;
      worldY = rotatedY;
      const perspective = 3.5 / (3.5 - worldZ);
      let x = worldX * 160 * scale * perspective;
      let y = worldY * 160 * scale * perspective + float;
      let streamSize = 1;
      if (arrival && destination) {
        // The final chapter is still moving: points rise into the mountain,
        // fade at the horizon and re-enter softly in the foreground.
        const journey = (animationTime / 12000 + i / count) % 1;
        const depth = Math.pow(1 - journey, 1.7);
        const branch = Math.floor(i / 3) % 3 - 1;
        // Meet the mountain's visible flank inside this illustration's lane.
        // The central horizon can sit left of the canvas on desktop; aiming
        // outside it made the final stream disappear at a hard canvas edge.
        const destinationX = clamp(destination.x - left, width * .25, width * .75);
        const destX = destinationX - width / 2 + branch * width * .13;
        const destY = destination.y - top - height / 2;
        const streamX = destX + seed.x * width * .44 * depth + Math.sin(journey * Math.PI * 2) * width * .04;
        const streamY = mix(height * .44, destY, journey);
        x = mix(x, streamX, arrival); y = mix(y, streamY, arrival);
        const visible = i % 3 === 0 ? smooth(journey / .08) * (1 - smooth((journey - .86) / .14)) * (.5 + depth * .5) : 0;
        streamSize = mix(1, Math.sqrt(visible), arrival);
      }
      let repelX = 0, repelY = 0, proximity = 0;
      if (burst) {
        const dx = x - burst.x, dy = y - burst.y;
        const distance = Math.hypot(dx, dy);
        const force = burstStrength * Math.min(width, height) * (0.19 + (i % 11) / 90);
        repelX = (distance > 1 ? dx / distance : seed.x) * force + seed.x * force * 0.4;
        repelY = (distance > 1 ? dy / distance : seed.y) * force + seed.y * force * 0.4;
      }
      if (pointer && !burst && !reducedMotion) {
        const dx = x - pointer.x, dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        proximity = clamp(1 - distance / radius);
        const push = proximity * proximity * radius * 0.65;
        repelX = (distance > 0.1 ? dx / distance : seed.x) * push;
        repelY = (distance > 0.1 ? dy / distance : seed.y) * push;
      }
      if (reducedMotion) { offsetsX[i] = offsetsY[i] = velocitiesX[i] = velocitiesY[i] = 0; }
      else {
        for (let step = 0; step < springSteps; step++) {
          velocitiesX[i] = (velocitiesX[i] + (repelX - offsetsX[i]) * .13 * springDt) * damping;
          velocitiesY[i] = (velocitiesY[i] + (repelY - offsetsY[i]) * .13 * springDt) * damping;
          offsetsX[i] += velocitiesX[i] * springDt; offsetsY[i] += velocitiesY[i] * springDt;
        }
        if (Math.abs(repelX - offsetsX[i]) + Math.abs(repelY - offsetsY[i]) + Math.abs(velocitiesX[i]) + Math.abs(velocitiesY[i]) > 0.08) moving = true;
        else { offsetsX[i] = repelX; offsetsY[i] = repelY; velocitiesX[i] = velocitiesY[i] = 0; }
      }
      const edge = clamp(Math.min(height / 2 - Math.abs(y + offsetsY[i]), width / 2 - Math.abs(x + offsetsX[i])) / 28);
      if (!edge) continue;
      const tone = proximity > 0.5 ? 6 : clamp(Math.round(mix(a[i].tone, b[i].tone, morph)), 0, 5);
      if (streamSize < .02) continue;
      const depthBucket = Math.round(clamp((worldZ + 1) / 2) * (depthLevels - 1));
      const bucket = tone * depthLevels + depthBucket;
      screenX[i] = width / 2 + x + offsetsX[i];
      screenY[i] = height / 2 + y + offsetsY[i];
      dotRadius[i] = baseRadius * perspective * seed.size * edge * streamSize;
      nextDot[i] = bucketHeads[bucket];
      bucketHeads[bucket] = i;
    }
    for (let bucket = 0; bucket < bucketHeads.length; bucket++) {
      if (bucketHeads[bucket] === -1) continue;
      context.fillStyle = palette[Math.floor(bucket / depthLevels)];
      context.globalAlpha = .2 + (bucket % depthLevels) / (depthLevels - 1) * .8;
      context.beginPath();
      for (let i = bucketHeads[bucket]; i !== -1; i = nextDot[i]) {
        context.moveTo(screenX[i] + dotRadius[i], screenY[i]);
        context.arc(screenX[i], screenY[i], dotRadius[i], 0, Math.PI * 2);
      }
      context.fill();
    }
    context.globalAlpha = 1;
    return moving;
  }
  resize();
  refreshTheme();
  return { resize, draw, setPointer, clearPointer, disperse, resetInteraction, refreshTheme };
}
