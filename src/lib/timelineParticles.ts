import { timelineArt } from './timelineArt.js';

type Point = { x: number; y: number; z: number; tone: number };
type Chapter = { motif: keyof typeof timelineArt };
type Position = { x: number; y: number };
type Dot = Position & { radius: number };

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
  const clouds = chapters.map(chapter => {
    const cloud: { points: Point[] | null } = { points: null };
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
      onReady?.();
    };
    image.onerror = () => onReady?.();
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
  let width = 1, height = 1, scale = 1, left = 0, top = 0;
  let pointer: Position | null = null;
  let burst: (Position & { start: number }) | null = null;
  let leanX = 0, leanY = 0;
  let previousTime = 0;
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
    const dt = clamp(previousTime ? (now - previousTime) / 16.67 : 1, 0.4, 2);
    previousTime = now;
    const radius = clamp(scale * 70, 70, 110);
    const buckets: Dot[][] = Array.from({ length: 35 }, () => []);
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
    for (let dotIndex = 0; dotIndex < visibleCount; dotIndex++) {
      const i = Math.floor(dotIndex * count / visibleCount);
      const seed = seeds[i];
      // Assemble the destination's parts in a meaningful order, instead of
      // morphing every chapter through the same cloud. All delays are driven
      // by the one reversible chapter progress value, never particle timers.
      let flowX = seed.fieldX, flowY = seed.fieldY;
      const point = { x: b[i].x * 160, y: b[i].y * 160, z: b[i].z }, px = clamp((point.x + 160) / 320), py = clamp((point.y + 160) / 320);
      let order = py;
      switch (chapters[to].motif) {
        case 'basketball': { const angle = Math.atan2(point.y, point.x) + (1 - phase) * 1.8; flowX = Math.cos(angle) * 170; flowY = Math.sin(angle) * 150; order = Math.hypot(point.x, point.y) / 160; break; }
        case 'graduation': flowX = point.x * 1.55 + seed.x * 24; flowY = -145 + py * 40 + seed.y * 20; break;
        case 'crypto': flowX = (point.y < 0 ? -150 : 150) + seed.x * 25; flowY = point.y * .9 + seed.y * 40; order = point.y < 0 ? px * .5 : .5 + px * .5; break;
        case 'business': flowX = point.x + seed.x * 40; flowY = 150 + seed.y * 28; order = px * .65 + (1 - py) * .35; break;
        case 'finance': flowX = Math.round(point.x / 45) * 45 + seed.x * 25; flowY = -145 + seed.y * 45; break;
        case 'learning': flowX = Math.sign(point.x) * (140 + seed.x * 30); flowY = point.y * .8 + seed.y * 45; order = Math.abs(point.x) / 160; break;
        case 'markets': flowX = point.x + Math.sin(point.y / 35 + phase * 3) * 32; flowY = 155 + seed.y * 20; order = px * .55 + (1 - py) * .45; break;
        case 'sumlino': flowX = (point.y < 0 ? -1 : 1) * (155 + seed.x * 20); flowY = point.y + seed.y * 40; order = point.y < 0 ? px : 1 - px; break;
        case 'mountains': flowX = point.x * 1.5 + seed.x * 20; flowY = 135 + seed.y * 35; order = (1 - py) * .7 + px * .3; break;
      }
      const release = smooth(phase / .34);
      const delay = clamp(order) * .2;
      const assemble = smooth((phase - .25 - delay) / (.75 - delay));
      const sphere = chapters[from].motif === 'basketball';
      const spin = sphere && !reducedMotion ? now * Math.PI * 2 * .035 / 1000 : 0;
      const sourceX = a[i].x * Math.cos(spin) + a[i].z * Math.sin(spin);
      const sourceZ = a[i].z * Math.cos(spin) - a[i].x * Math.sin(spin);
      let worldX = mix(mix(sourceX, flowX / 160, release), point.x / 160, assemble);
      let worldY = mix(mix(a[i].y, flowY / 160, release), point.y / 160, assemble);
      let worldZ = mix(sourceZ, point.z, morph) + seed.x * scatter * .32;
      const idle = reducedMotion ? 0 : (1 - scatter) * (1 - arrival);
      const yaw = Math.sin(now / 5300) * .32 * idle * (sphere ? morph : 1) + leanY;
      const pitch = Math.sin(now / 7300) * .055 * idle - leanX;
      const rotatedX = worldX * Math.cos(yaw) + worldZ * Math.sin(yaw);
      worldZ = worldZ * Math.cos(yaw) - worldX * Math.sin(yaw);
      worldX = rotatedX;
      const rotatedY = worldY * Math.cos(pitch) - worldZ * Math.sin(pitch);
      worldZ = worldY * Math.sin(pitch) + worldZ * Math.cos(pitch);
      worldY = rotatedY;
      const perspective = 3.5 / (3.5 - worldZ);
      let x = worldX * 160 * scale * perspective;
      let y = worldY * 160 * scale * perspective + Math.sin(now / 5400) * 1.4 * scale * idle;
      let streamSize = 1;
      if (arrival && destination) {
        // The final chapter is still moving: points rise into the mountain,
        // fade at the horizon and re-enter softly in the foreground.
        const journey = (now / 12000 + i / count) % 1;
        const depth = Math.pow(1 - journey, 1.7);
        const branch = Math.floor(i / 3) % 3 - 1;
        const destX = destination.x - left - width / 2 + branch * width * .19;
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
        const damping = Math.pow(0.72, dt);
        velocitiesX[i] = (velocitiesX[i] + (repelX - offsetsX[i]) * 0.13 * dt) * damping;
        velocitiesY[i] = (velocitiesY[i] + (repelY - offsetsY[i]) * 0.13 * dt) * damping;
        offsetsX[i] += velocitiesX[i] * dt; offsetsY[i] += velocitiesY[i] * dt;
        if (Math.abs(repelX - offsetsX[i]) + Math.abs(repelY - offsetsY[i]) + Math.abs(velocitiesX[i]) + Math.abs(velocitiesY[i]) > 0.08) moving = true;
        else { offsetsX[i] = repelX; offsetsY[i] = repelY; velocitiesX[i] = velocitiesY[i] = 0; }
      }
      const edge = clamp((height / 2 - Math.abs(y + offsetsY[i])) / 32);
      if (!edge) continue;
      const tone = proximity > 0.5 ? 6 : clamp(Math.round(mix(a[i].tone, b[i].tone, morph)), 0, 5);
      if (streamSize < .02) continue;
      const depthBucket = Math.round(clamp((worldZ + 1) / 2) * 4);
      buckets[tone * 5 + depthBucket].push({ x: width / 2 + x + offsetsX[i], y: height / 2 + y + offsetsY[i], radius: clamp(scale * 0.85, 0.8, 1.4) * perspective * seed.size * edge * (1 - scatter * 0.2) * streamSize });
    }
    for (let bucket = 0; bucket < buckets.length; bucket++) {
      context.fillStyle = palette[Math.floor(bucket / 5)]; context.globalAlpha = .2 + (bucket % 5) * .2; context.beginPath();
      for (const dot of buckets[bucket]) { context.moveTo(dot.x + dot.radius, dot.y); context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2); }
      context.fill();
    }
    context.globalAlpha = 1;
    return moving;
  }
  resize();
  refreshTheme();
  return { resize, draw, setPointer, clearPointer, disperse, resetInteraction, refreshTheme };
}
