(function () {
  const canvas = document.getElementById("starfield");
  const sceneWrap = document.getElementById("sceneWrap");

  const ufoFlyer = {
    el: null,
    pattern: "hoverDash",
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    midX: 0,
    midY: 0,
    departX: 0,
    departY: 0,
    startTime: 0,
    duration: 16000,
    approachDuration: 0,
    hoverPauseDuration: 0,
    hoverDuration: 0,
    hoverReturnDuration: 0,
    departDuration: 0,
    hoverAmp: 0,
    hoverSpeed: 0,
    hoverPhase: 0,
    hoverAxis: "y",
    totalDuration: 0,
    scale: 0.7
  };

  function hashNoise(x) {
    return Math.abs(Math.sin(x * 12.9898 + 78.233) * 43758.5453) % 1;
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function perlin1D(x) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const t = x - x0;
    const g0 = hashNoise(x0) * 2 - 1;
    const g1 = hashNoise(x1) * 2 - 1;
    const v0 = g0 * t;
    const v1 = g1 * (t - 1);
    return v0 + (v1 - v0) * smoothstep(t);
  }

  function getNextSpawnDelay() {
    return 60000 + Math.random() * 120000;
  }

  function initUfoFlyer() {
    if (!sceneWrap || !canvas) return;
    const img = document.createElement("img");
    img.id = "ufoFlyer";
    img.src = "assets/images/ufo1.png";
    img.alt = "ufo";
    sceneWrap.appendChild(img);
    ufoFlyer.el = img;
    resetUfoFlyer(performance.now());
  }

  function resetUfoFlyer(now) {
    if (!ufoFlyer.el || !canvas) return;
    ufoFlyer.pattern = Math.random() < 0.5 ? "straight" : "hoverDash";
    if (ufoFlyer.pattern === "hoverDash") {
      applyHoverDashFlight(now);
      return;
    }
    applyStraightFlight(now);
  }

  function applyStraightFlight(now) {
    const margin = Math.max(canvas.width, canvas.height) * 0.25;
    const fromLeft = Math.random() < 0.5;
    const verticalRange = canvas.height + margin * 0.6;
    const startY = -margin * 0.3 + Math.random() * verticalRange;
    const rise = margin * (0.35 + Math.random() * 0.35);

    ufoFlyer.startX = fromLeft ? -margin : canvas.width + margin;
    ufoFlyer.endX = fromLeft ? canvas.width + margin : -margin;
    ufoFlyer.startY = startY;
    ufoFlyer.endY = startY - rise;
    ufoFlyer.duration = 14000 + Math.random() * 8000;
    ufoFlyer.totalDuration = ufoFlyer.duration;
    ufoFlyer.startTime = now + getNextSpawnDelay();
    ufoFlyer.scale = 0.55 + Math.random() * 0.2;
  }

  function applyHoverDashFlight(now) {
    const margin = Math.max(canvas.width, canvas.height) * 0.25;
    const fromLeft = Math.random() < 0.5;
    const startY = canvas.height * (0.2 + Math.random() * 0.6);
    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.5;
    const avoidRadius = Math.min(canvas.width, canvas.height) * 0.32;
    let midX = centerX;
    let midY = centerY;
    for (let i = 0; i < 10; i += 1) {
      midX = canvas.width * (0.28 + Math.random() * 0.44);
      midY = canvas.height * (0.28 + Math.random() * 0.44);
      const dx = midX - centerX;
      const dy = midY - centerY;
      if (Math.hypot(dx, dy) > avoidRadius) {
        break;
      }
    }
    const departToLeft = !fromLeft;
    const departOffset = canvas.height * (0.35 + Math.random() * 0.45);
    const departDirection = Math.random() < 0.5 ? -1 : 1;

    ufoFlyer.startX = fromLeft ? -margin : canvas.width + margin;
    ufoFlyer.startY = startY;
    ufoFlyer.midX = midX;
    ufoFlyer.midY = midY;
    ufoFlyer.departX = departToLeft ? -margin : canvas.width + margin;
    ufoFlyer.departY = midY + departOffset * departDirection;

    ufoFlyer.approachDuration = 3500 + Math.random() * 1800;
    ufoFlyer.hoverPauseDuration = 2000;
    ufoFlyer.hoverDuration = 5200 + Math.random() * 3200;
    ufoFlyer.hoverReturnDuration = 700;
    ufoFlyer.departDuration = 3800 + Math.random() * 2200;
    ufoFlyer.totalDuration =
      ufoFlyer.approachDuration +
      ufoFlyer.hoverPauseDuration +
      ufoFlyer.hoverDuration +
      ufoFlyer.hoverReturnDuration +
      ufoFlyer.departDuration;
    ufoFlyer.startTime = now + getNextSpawnDelay();
    ufoFlyer.hoverAmp = 3 + Math.random() * 4;
    ufoFlyer.hoverSpeed = 0.0012 + Math.random() * 0.0009;
    ufoFlyer.hoverPhase = Math.random() * Math.PI * 2;
    ufoFlyer.hoverAxis = Math.random() < 0.5 ? "x" : "y";
    ufoFlyer.scale = 0.55 + Math.random() * 0.2;
  }

  function updateUfoFlyer(now) {
    if (!ufoFlyer.el) return;
    if (now < ufoFlyer.startTime) {
      ufoFlyer.el.style.opacity = "0";
      return;
    }
    const elapsed = now - ufoFlyer.startTime;
    const duration = ufoFlyer.totalDuration || ufoFlyer.duration;
    if (elapsed >= duration) {
      resetUfoFlyer(now);
      ufoFlyer.el.style.opacity = "0";
      return;
    }

    const t = elapsed / duration;
    const fadeIn = Math.min(1, t * 4);
    const fadeOut = Math.min(1, (1 - t) * 4);
    const opacity = Math.min(fadeIn, fadeOut) * 0.75;
    let x = ufoFlyer.startX;
    let y = ufoFlyer.startY;
    let scale = ufoFlyer.scale;

    if (ufoFlyer.pattern === "hoverDash") {
      if (elapsed < ufoFlyer.approachDuration) {
        const localT = elapsed / ufoFlyer.approachDuration;
        x = ufoFlyer.startX + (ufoFlyer.midX - ufoFlyer.startX) * localT;
        y = ufoFlyer.startY + (ufoFlyer.midY - ufoFlyer.startY) * localT;
      } else if (elapsed < ufoFlyer.approachDuration + ufoFlyer.hoverPauseDuration) {
        x = ufoFlyer.midX;
        y = ufoFlyer.midY;
      } else if (elapsed < ufoFlyer.approachDuration + ufoFlyer.hoverPauseDuration + ufoFlyer.hoverDuration) {
        const hoverTime = elapsed - ufoFlyer.approachDuration - ufoFlyer.hoverPauseDuration;
        const noise = perlin1D(hoverTime * ufoFlyer.hoverSpeed + ufoFlyer.hoverPhase);
        if (ufoFlyer.hoverAxis === "x") {
          x = ufoFlyer.midX + noise * ufoFlyer.hoverAmp;
          y = ufoFlyer.midY;
        } else {
          x = ufoFlyer.midX;
          y = ufoFlyer.midY + noise * ufoFlyer.hoverAmp;
        }
      } else if (
        elapsed <
        ufoFlyer.approachDuration +
          ufoFlyer.hoverPauseDuration +
          ufoFlyer.hoverDuration +
          ufoFlyer.hoverReturnDuration
      ) {
        const hoverEndOffset =
          perlin1D(ufoFlyer.hoverDuration * ufoFlyer.hoverSpeed + ufoFlyer.hoverPhase) * ufoFlyer.hoverAmp;
        const returnTime =
          elapsed -
          ufoFlyer.approachDuration -
          ufoFlyer.hoverPauseDuration -
          ufoFlyer.hoverDuration;
        const localT = returnTime / ufoFlyer.hoverReturnDuration;
        const smoothT = localT * localT * (3 - 2 * localT);
        if (ufoFlyer.hoverAxis === "x") {
          x = ufoFlyer.midX + hoverEndOffset * (1 - smoothT);
          y = ufoFlyer.midY;
        } else {
          x = ufoFlyer.midX;
          y = ufoFlyer.midY + hoverEndOffset * (1 - smoothT);
        }
      } else {
        const departTime =
          elapsed -
          ufoFlyer.approachDuration -
          ufoFlyer.hoverPauseDuration -
          ufoFlyer.hoverDuration -
          ufoFlyer.hoverReturnDuration;
        const localT = departTime / ufoFlyer.departDuration;
        const smoothT = localT * localT * (3 - 2 * localT);
        x = ufoFlyer.midX + (ufoFlyer.departX - ufoFlyer.midX) * smoothT;
        y = ufoFlyer.midY + (ufoFlyer.departY - ufoFlyer.midY) * smoothT;
        scale = ufoFlyer.scale * (1 - 0.08 * smoothT);
      }
    } else {
      const smoothT = t * t * (3 - 2 * t);
      x = ufoFlyer.startX + (ufoFlyer.endX - ufoFlyer.startX) * smoothT;
      y = ufoFlyer.startY + (ufoFlyer.endY - ufoFlyer.startY) * smoothT;
      scale = ufoFlyer.scale * (1 - 0.1 * smoothT);
    }

    ufoFlyer.el.style.opacity = opacity.toFixed(3);
    ufoFlyer.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }

  function animateUfo() {
    updateUfoFlyer(performance.now());
    requestAnimationFrame(animateUfo);
  }

  window.addEventListener("resize", () => {
    resetUfoFlyer(performance.now());
  });

  initUfoFlyer();
  animateUfo();
})();
