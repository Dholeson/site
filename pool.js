// the pool — text goes in, nothing comes back out.
// no storage, no network. read it and see.

(function () {
  "use strict";

  var canvas = document.getElementById("pool");
  var ctx = canvas.getContext("2d");
  var form = document.getElementById("offering");
  var input = document.getElementById("thought");

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var IDLE_THOUGHTS = [
    "this sentence is already going",
    "the tide doesn’t take requests",
    "held, briefly, like everything",
    "what stays is the shape, not the stuff",
    "every ending, on time",
    "I was here, the way water is",
    "you’re the one who’ll remember this",
    "small enough to see all the way into",
    "the pool keeps nothing and misses nothing",
    "somewhere, two opposite points agree"
  ];

  var dpr = 1;
  var W = 0, H = 0;

  var motes = [];
  var particles = [];
  var ripples = [];
  var current = null;      // { text, state: "in"|"hold"|"out", t, hold, size }
  var idleAt = 0;          // timestamp when the pool may think for itself
  var lastIdle = -1;

  var colors = { ink: [42, 36, 32], glass: [31, 110, 96], faded: [111, 101, 87] };

  function readColors() {
    var style = getComputedStyle(document.documentElement);
    colors.ink = hex(style.getPropertyValue("--ink"), colors.ink);
    colors.glass = hex(style.getPropertyValue("--glass"), colors.glass);
    colors.faded = hex(style.getPropertyValue("--faded"), colors.faded);
  }

  function hex(value, fallback) {
    var m = value.trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedMotes();
  }

  function seedMotes() {
    motes.length = 0;
    var count = Math.round(Math.min(48, W / 16));
    for (var i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.2,
        a: 0.04 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 5
      });
    }
  }

  function fontFor(text) {
    var size = 34;
    do {
      ctx.font = "italic " + size + "px Charter, 'Iowan Old Style', Palatino, Georgia, serif";
      if (ctx.measureText(text).width <= W * 0.86) break;
      size -= 2;
    } while (size > 15);
    return size;
  }

  function offer(text, hold) {
    current = { text: text, state: "in", t: 0, hold: hold, size: fontFor(text) };
  }

  // sample the drawn text into particles, then let the water have them
  function dissolve() {
    if (reducedMotion.matches) {
      current.state = "out";
      current.t = 0;
      return;
    }
    var off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    var octx = off.getContext("2d", { willReadFrequently: true });
    octx.font = "italic " + current.size + "px Charter, 'Iowan Old Style', Palatino, Georgia, serif";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#fff";
    octx.fillText(current.text, W / 2, H / 2);

    var data = octx.getImageData(0, 0, W, H).data;
    var stride = 2;
    var est = current.text.length * current.size * 0.5 / (stride * stride);
    if (est > 2400) stride = 3;

    for (var y = 0; y < H; y += stride) {
      for (var x = 0; x < W; x += stride) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          var toGlass = Math.random() * 0.7;
          particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 4,
            age: 0,
            ttl: 2.5 + Math.random() * 3,
            r: 0.7 + Math.random() * 0.9,
            c: mix(colors.ink, colors.glass, toGlass)
          });
        }
      }
    }
    ripples.push({ x: W / 2, y: H / 2, age: 0, ttl: 1.8 });
    current = null;
    idleAt = performance.now() + 9000 + Math.random() * 6000;
  }

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  var last = performance.now();

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var t = now / 1000;

    ctx.clearRect(0, 0, W, H);

    // motes: the pool is never quite still
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.x += Math.sin(t * 0.3 + m.phase) * m.speed * dt;
      m.y += Math.cos(t * 0.23 + m.phase * 1.7) * m.speed * 0.6 * dt - 1.2 * dt;
      if (m.y < -4) m.y = H + 4;
      if (m.x < -4) m.x = W + 4;
      if (m.x > W + 4) m.x = -4;
      ctx.fillStyle = rgba(colors.faded, m.a * (0.8 + 0.2 * Math.sin(t + m.phase)));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ripples
    for (i = ripples.length - 1; i >= 0; i--) {
      var rp = ripples[i];
      rp.age += dt;
      var k = rp.age / rp.ttl;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(colors.glass, 0.25 * (1 - k));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, 20 + k * W * 0.35, (20 + k * W * 0.35) * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // dissolving letters, drifting like ink
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      var life = p.age / p.ttl;
      if (life >= 1) { particles.splice(i, 1); continue; }
      var swirl = Math.sin(p.x * 0.013 + t * 0.7) * Math.cos(p.y * 0.011 - t * 0.5);
      p.vx += Math.cos(swirl * Math.PI) * 14 * dt;
      p.vy += Math.sin(swirl * Math.PI) * 10 * dt + 6 * dt * life;
      p.vx *= 0.965;
      p.vy *= 0.965;
      p.x += p.vx * dt * (1 + life);
      p.y += p.vy * dt * (1 + life);
      ctx.fillStyle = rgba(p.c, 0.85 * (1 - ease(life)));
      ctx.fillRect(p.x, p.y, p.r, p.r);
    }

    // the current thought
    if (current) {
      current.t += dt;
      var alpha = 0;
      if (current.state === "in") {
        alpha = ease(Math.min(current.t / 1.1, 1));
        if (current.t >= 1.1) { current.state = "hold"; current.t = 0; }
      } else if (current.state === "hold") {
        alpha = 1;
        if (current.t >= current.hold) dissolve();
      } else if (current.state === "out") {
        alpha = 1 - ease(Math.min(current.t / 1.6, 1));
        if (current.t >= 1.6) {
          current = null;
          idleAt = now + 9000 + Math.random() * 6000;
        }
      }
      if (current) {
        ctx.font = "italic " + current.size + "px Charter, 'Iowan Old Style', Palatino, Georgia, serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = rgba(colors.ink, alpha * 0.92);
        ctx.fillText(current.text, W / 2, H / 2);
      }
    } else if (particles.length === 0 && now >= idleAt) {
      // left alone, the pool thinks its own thoughts
      var pick;
      do { pick = Math.floor(Math.random() * IDLE_THOUGHTS.length); } while (pick === lastIdle);
      lastIdle = pick;
      offer(IDLE_THOUGHTS[pick], 2.4);
    }

    requestAnimationFrame(frame);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    particles.length = 0;
    offer(text, 1.5);
    input.value = "";
  });

  window.addEventListener("resize", resize);
  if (window.matchMedia) {
    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme.addEventListener) scheme.addEventListener("change", readColors);
  }

  readColors();
  resize();
  idleAt = performance.now() + 2500;
  requestAnimationFrame(frame);
})();
