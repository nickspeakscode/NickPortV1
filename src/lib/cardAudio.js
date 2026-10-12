// Prepared from Nick's recordings; see public/audio/cards/README.md.
// Seconds from the start of the existing three-second card choreography.
const CUES = [
  { src: '/audio/cards/fan.wav', at: 0.50 },
  { src: '/audio/cards/riffle.wav', at: 1.24 },
  { src: '/audio/cards/hindu.wav', at: 0.936 },
];

export function createCardAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const silent = { unlock() {}, play() {}, stop() {}, canPlay: () => true };
  if (!AudioContext) return silent;
  let context;
  try { context = new AudioContext({ latencyHint: 'interactive' }); }
  catch { return silent; }

  let unlocked = false;
  let epoch = 0;
  let active = null;
  let resuming = Promise.resolve();
  let buffers = null;
  const loadBuffers = () => (buffers ??= CUES.map(cue => fetch(cue.src)
    .then(response => {
      if (!response.ok) throw new Error('Card sound unavailable');
      return response.arrayBuffer();
    })
    .then(bytes => context.decodeAudioData(bytes))
    .catch(() => null)));
  const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.navigator?.connection?.saveData;
  if (!quiet && typeof window.requestIdleCallback === 'function') window.requestIdleCallback(loadBuffers, { timeout: 6000 });

  function unlock() {
    // Must be invoked synchronously by a real input handler on iOS Safari.
    // Retry after interruption; never start playback merely on resume.
    // iOS 17+ routes playback sessions through media volume, including when
    // the Ring/Silent switch is silent. Older browsers retain their default.
    try {
      if (window.navigator?.audioSession) window.navigator.audioSession.type = 'playback';
    } catch { /* Unsupported session policy must not prevent gesture unlock. */ }
    unlocked = true;
    loadBuffers();
    if (context.state !== 'running') {
      try { resuming = context.resume().catch(() => {}); }
      catch { resuming = Promise.resolve(); }
    }
  }

  function stop() {
    epoch += 1;
    if (!active) return;
    active.onended = null;
    try { active.stop(); } catch { /* Already ended. */ }
    active.disconnect();
    active = null;
  }

  function play(variation, animationStartTime) {
    stop();
    // A load/hover intro stays silent until a user has unlocked audio.
    if (!unlocked) return;
    const cue = CUES[variation];
    if (!cue) return;
    const request = epoch;
    Promise.all([loadBuffers()[variation], resuming]).then(([buffer]) => {
      if (request !== epoch || !buffer || context.state !== 'running') return;
      const elapsed = (document.timeline.currentTime - animationStartTime) / 1000;
      // Slow fetch/decode/resume must not introduce a delayed sound effect.
      if (elapsed > cue.at + 0.075) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const offset = Math.max(0, elapsed - cue.at);
      if (offset >= buffer.duration) { source.disconnect(); return; }
      source.onended = () => {
        source.disconnect();
        if (active === source) active = null;
      };
      active = source;
      // WAV assets contain no MP3 encoder delay. Web Audio's clock schedules
      // the cue against the same timeline origin used by the card transforms.
      source.start(context.currentTime + Math.max(0, cue.at - elapsed), offset);
    }).catch(() => { /* Audio failure must never interrupt the card trick. */ });
  }

  context.addEventListener('statechange', () => {
    if (context.state !== 'running') stop();
  });
  // Hover cannot unlock browser audio. Do not let it consume the first click
  // with a silent trick, or do the same after an audio interruption.
  const canPlay = () => unlocked && context.state === 'running';
  return { unlock, play, stop, canPlay };
}
