const pokemonOptions = [
  { name: "Bulbasaur", src: "/pokemon/bulbasaur.webp", size: "sm" },
  { name: "Shinx", src: "/pokemon/shinx.webp", size: "sm" },
  { name: "Flareon", src: "/pokemon/flareon.webp", size: "lg" },
  { name: "Gengar", src: "/pokemon/gengar.webp", size: "md" },
  { name: "Pikachu", src: "/pokemon/pikachu.webp", size: "md" },
  { name: "Blastoise", src: "/pokemon/blastoise.webp", size: "lg" },
  { name: "Dragonite", src: "/pokemon/dragonite.webp", size: "sm" },
  { name: "Mewtwo", src: "/pokemon/mewtwo.webp", size: "md" },
  { name: "Charizard", src: "/pokemon/charizard.webp", size: "lg" },
  { name: "Giratina", src: "/pokemon/giratina.webp", size: "lg" },
];

const OBSTACLE_SELECTOR = [
  ".wordmark",
  ".site-header nav a",
  ".market-strip",
  ".social-icons a",
  ".hero-copy",
  ".contact-action",
  ".about-copy",
  ".about-portrait",
  ".section-heading",
  ".highlights-row",
  ".highlights-more",
  ".index-intro",
  ".index-row",
  ".home-index-more",
  ".article-header",
  ".article-body p",
  ".article-body h2",
  ".note-detail-header",
  ".learning-detail-title",
  ".resource-detail-cover",
  ".resource-detail-copy",
].join(", ");

export function initializePokemonRelease({ onMove } = {}) {
  const button = document.getElementById("pokeballRelease");
  const pokemon = document.getElementById("pokemonWalker");
  const sprite = document.getElementById("pokemonSprite");

  if (!button || !pokemon || !sprite) return () => {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    released: false,
    dragging: false,
    x: window.innerWidth - 150,
    y: 120,
    vx: 1.5,
    vy: 1.1,
    facing: 1,
    frameId: 0,
    lastTime: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pointerX: 0,
    pointerY: 0,
    pointerActive: false,
    // Layout reads are cached: the sprite size only changes on swap/resize,
    // and obstacles are re-measured a few times a second, not every frame.
    width: 0,
    height: 0,
    topLimit: 70,
    obstacles: [],
    obstaclesAt: 0,
    openTimer: 0,
  };

  function measure() {
    const rect = pokemon.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.topLimit = Math.max(70, (document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 62) + 8);
    state.obstaclesAt = 0;
  }

  function setPosition() {
    const bob = reducedMotion.matches ? 0 : Math.sin(performance.now() / 140) * 5;
    pokemon.style.setProperty("--x", `${state.x}px`);
    pokemon.style.setProperty("--y", `${state.y + bob}px`);
    pokemon.style.setProperty("--facing", state.facing);
  }

  function getBounds() {
    if (!state.width) measure();
    const rect = { width: state.width, height: state.height };
    return {
      left: state.x + rect.width * 0.18,
      top: state.y + rect.height * 0.2,
      right: state.x + rect.width * 0.82,
      bottom: state.y + rect.height * 0.82,
      width: rect.width * 0.64,
      height: rect.height * 0.62,
    };
  }

  function getOverlap(a, b) {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 0 && y > 0 ? { x, y } : null;
  }

  function launch() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.45 + Math.random() * 0.85;
    state.vx = Math.cos(angle) * speed || 1.4;
    state.vy = Math.sin(angle) * speed || 1;
    state.facing = state.vx >= 0 ? 1 : -1;
  }

  function normalizeSpeed(maxSpeed = 2.65) {
    const speed = Math.hypot(state.vx, state.vy);
    if (speed < 0.01) {
      launch();
      return;
    }
    const target = Math.min(maxSpeed, Math.max(1.45, speed));
    state.vx = (state.vx / speed) * target;
    state.vy = (state.vy / speed) * target;
  }

  function clampToViewport(bounds = getBounds()) {
    const padding = 8;
    const maxX = window.innerWidth - bounds.width - padding;
    const maxY = window.innerHeight - bounds.height - padding;
    const hit = { x: 0, y: 0 };

    if (state.x < padding) {
      state.x = padding;
      hit.x = 1;
    } else if (state.x > maxX) {
      state.x = maxX;
      hit.x = -1;
    }

    if (state.y < state.topLimit) {
      state.y = state.topLimit;
      hit.y = 1;
    } else if (state.y > maxY) {
      state.y = maxY;
      hit.y = -1;
    }

    return hit;
  }

  function getObstacles() {
    const now = performance.now();
    if (now - state.obstaclesAt < 150) return state.obstacles;
    state.obstaclesAt = now;
    state.obstacles = Array.from(document.querySelectorAll(OBSTACLE_SELECTOR))
      .map((target) => ({ target, rect: target.getBoundingClientRect() }))
      .filter(({ target, rect }) => {
        if (target === pokemon || target === button) return false;
        if (pokemon.contains(target) || button.contains(target)) return false;
        return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .map(({ rect }) => ({
        left: rect.left - 6,
        top: rect.top - 6,
        right: rect.right + 6,
        bottom: rect.bottom + 6,
      }));
    return state.obstacles;
  }

  function bounceOffObstacles() {
    const walkerRect = getBounds();
    const viewportHit = clampToViewport(walkerRect);
    if (viewportHit.x) state.vx = Math.abs(state.vx) * viewportHit.x;
    if (viewportHit.y) state.vy = Math.abs(state.vy) * viewportHit.y;

    const nextRect = getBounds();
    for (const obstacle of getObstacles()) {
      const overlap = getOverlap(nextRect, obstacle);
      if (!overlap) continue;

      if (overlap.x < overlap.y) {
        state.x += nextRect.left < obstacle.left ? -overlap.x - 2 : overlap.x + 2;
        state.vx *= -1;
      } else {
        state.y += nextRect.top < obstacle.top ? -overlap.y - 2 : overlap.y + 2;
        state.vy *= -1;
      }

      state.vx += (Math.random() - 0.5) * 0.34;
      state.vy += (Math.random() - 0.5) * 0.34;
      normalizeSpeed();
      break;
    }
  }

  function applyCursorPush() {
    if (!state.pointerActive) return;

    const bounds = getBounds();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const dx = centerX - state.pointerX;
    const dy = centerY - state.pointerY;
    const distance = Math.hypot(dx, dy);
    if (distance >= 132 || distance < 1) return;

    const falloff = (1 - distance / 132) ** 2;
    const force = 0.38 + falloff * 1.18;
    state.vx += (dx / distance) * force;
    state.vy += (dy / distance) * force;
    normalizeSpeed(3.25);
  }

  function notifyMove() {
    onMove?.(getBounds(), { vx: state.vx, vy: state.vy });
  }

  function animate(time) {
    if (!state.released || document.hidden) {
      state.frameId = 0;
      return;
    }

    const dt = Math.min(2.2, Math.max(0.75, (time - (state.lastTime || time)) / 16.67));
    state.lastTime = time;

    if (!state.dragging) {
      applyCursorPush();
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      bounceOffObstacles();
    } else {
      clampToViewport();
    }

    state.facing = state.vx >= 0 ? 1 : -1;
    setPosition();
    notifyMove();
    state.frameId = requestAnimationFrame(animate);
  }

  function ensureAnimation() {
    if (!state.frameId && state.released && !document.hidden) {
      state.lastTime = 0;
      state.frameId = requestAnimationFrame(animate);
    }
  }

  function releasePokemon() {
    const selected = pokemonOptions[Math.floor(Math.random() * pokemonOptions.length)];
    sprite.src = selected.src;
    sprite.alt = selected.name;
    pokemon.dataset.size = selected.size;
    pokemon.title = `${selected.name}: double-click or press Escape to send back`;
    button.setAttribute("aria-label", `Release another Pokémon (Escape sends ${selected.name} back)`);
    state.width = 0;
    // Restart the pop even on rapid repeat clicks.
    pokemon.classList.remove("is-popping");
    void pokemon.offsetWidth;
    pokemon.classList.add("is-popping");

    button.classList.add("is-open");
    clearTimeout(state.openTimer);
    state.openTimer = window.setTimeout(() => button.classList.remove("is-open"), 700);
    launch();

    if (!state.released) {
      const ballRect = button.getBoundingClientRect();
      state.x = ballRect.left - 40;
      state.y = ballRect.bottom + 8;
      state.released = true;
      pokemon.classList.add("is-released");
      setPosition();
    }

    // Reduced motion: the Pokemon appears and stays put (it can still be dragged).
    if (reducedMotion.matches) setPosition();
    else ensureAnimation();
  }

  function recallPokemon() {
    if (!state.released) return;
    state.released = false;
    state.dragging = false;
    if (state.frameId) cancelAnimationFrame(state.frameId);
    state.frameId = 0;
    pokemon.classList.remove("is-released", "is-dragging", "is-popping");
    pokemon.removeAttribute("title");
    button.setAttribute("aria-label", "Release a random Pokémon");
  }

  function handleKeydown(event) {
    if (event.key === "Escape") recallPokemon();
  }

  function handleMotionChange() {
    if (!state.released) return;
    if (reducedMotion.matches && state.frameId) {
      cancelAnimationFrame(state.frameId);
      state.frameId = 0;
    }
    setPosition();
    if (!reducedMotion.matches) ensureAnimation();
  }

  function startDrag(event) {
    if (!state.released) return;
    const rect = pokemon.getBoundingClientRect();
    state.dragging = true;
    state.dragOffsetX = event.clientX - rect.left;
    state.dragOffsetY = event.clientY - rect.top;
    pokemon.classList.add("is-dragging");
    pokemon.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function updatePointer(event) {
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.pointerActive = true;
    if (!state.dragging) return;

    const previousX = state.x;
    const previousY = state.y;
    state.x = event.clientX - state.dragOffsetX;
    state.y = event.clientY - state.dragOffsetY;
    state.vx = (state.x - previousX) * 0.22;
    state.vy = (state.y - previousY) * 0.22;
    clampToViewport();
    setPosition();
    notifyMove();
  }

  function endDrag(event) {
    // A lifted finger is not a cursor to steer around.
    if (event.pointerType === "touch") state.pointerActive = false;
    if (!state.dragging) return;
    state.dragging = false;
    pokemon.classList.remove("is-dragging");
    pokemon.releasePointerCapture?.(event.pointerId);
    normalizeSpeed(3.1);
  }

  function handlePointerOut(event) {
    if (!event.relatedTarget) state.pointerActive = false;
  }

  function handleVisibilityChange() {
    if (document.hidden && state.frameId) {
      cancelAnimationFrame(state.frameId);
      state.frameId = 0;
    } else if (!reducedMotion.matches) {
      ensureAnimation();
    }
  }

  function handleResize() {
    state.width = 0;
    if (!state.released) return;
    clampToViewport();
    setPosition();
  }

  function clearPopAnimation() {
    pokemon.classList.remove("is-popping");
  }

  button.addEventListener("click", releasePokemon);
  pokemon.addEventListener("dblclick", recallPokemon);
  sprite.addEventListener("load", () => { state.width = 0; });
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("pointerout", handlePointerOut);
  reducedMotion.addEventListener("change", handleMotionChange);
  pokemon.addEventListener("animationend", clearPopAnimation);
  pokemon.addEventListener("pointerenter", launch);
  pokemon.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", updatePointer);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", handleResize);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    if (state.frameId) cancelAnimationFrame(state.frameId);
    clearTimeout(state.openTimer);
    button.removeEventListener("click", releasePokemon);
    pokemon.removeEventListener("dblclick", recallPokemon);
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("pointerout", handlePointerOut);
    reducedMotion.removeEventListener("change", handleMotionChange);
    pokemon.removeEventListener("animationend", clearPopAnimation);
    pokemon.removeEventListener("pointerenter", launch);
    pokemon.removeEventListener("pointerdown", startDrag);
    window.removeEventListener("pointermove", updatePointer);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
