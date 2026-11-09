/* AstroYou revamp — shared primitives for the three concept mockups.
 * Each primitive renders into a container and is styled by the page's CSS.
 * Data is illustrative for a fixed moment: Sat 7 Nov 2026, 10:05, Lucknow.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = () => typeof window.gsap !== "undefined" && !reduce;

  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmt = (min) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

  const SIGNS = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  const RASHI = [
    "Mesha",
    "Vrishabha",
    "Mithuna",
    "Karka",
    "Simha",
    "Kanya",
    "Tula",
    "Vrischika",
    "Dhanu",
    "Makara",
    "Kumbha",
    "Meena",
  ];
  const GLYPH = [
    "♈︎",
    "♉︎",
    "♊︎",
    "♋︎",
    "♌︎",
    "♍︎",
    "♎︎",
    "♏︎",
    "♐︎",
    "♑︎",
    "♒︎",
    "♓︎",
  ];
  const NAKS = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashira",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
  ];

  const DATA = {
    name: "Meera",
    nowLabel: "10:05",
    now: "10:05",
    dayStart: "05:30",
    dayEnd: "19:00",
    sunrise: "06:20",
    sunset: "17:20",
    periods: [
      { name: "Gulika", start: "06:20", end: "07:42", kind: "soft" },
      { name: "Rahu Kaal", start: "09:05", end: "10:27", kind: "avoid" },
      { name: "Abhijit", start: "11:26", end: "12:14", kind: "good" },
      { name: "Yamaganda", start: "13:12", end: "14:35", kind: "soft" },
    ],
    tithi: { index: 28, name: "Krishna Trayodashi", lit: 0.06, waxing: false },
    nakshatraToday: 13, // Chitra
    // Illustrative sidereal longitudes for today (degrees).
    planets: [
      { id: "Su", name: "Sun", lon: 201 },
      { id: "Mo", name: "Moon", lon: 178, moon: true },
      { id: "Me", name: "Mercury", lon: 214 },
      { id: "Ve", name: "Venus", lon: 192 },
      { id: "Ma", name: "Mars", lon: 118 },
      { id: "Ju", name: "Jupiter", lon: 86 },
      { id: "Sa", name: "Saturn", lon: 335, retro: false },
      { id: "Ra", name: "Rahu", lon: 312 },
      { id: "Ke", name: "Ketu", lon: 132 },
    ],
    natalMoon: 339.7,
    natalLagna: 127.7,
    birthYear: 1995.62,
    nowYear: 2026.85,
    dasha: [
      { lord: "Saturn", from: 1995.62, to: 2005.4 },
      { lord: "Mercury", from: 2005.4, to: 2022.5 },
      { lord: "Ketu", from: 2022.5, to: 2029.5, now: true },
      { lord: "Venus", from: 2029.5, to: 2049.5 },
      { lord: "Sun", from: 2049.5, to: 2055.5 },
    ],
    // Antardashas inside the current Ketu period.
    sub: [
      { lord: "Ke", from: 2022.5, to: 2022.9 },
      { lord: "Ve", from: 2022.9, to: 2024.1 },
      { lord: "Su", from: 2024.1, to: 2024.45 },
      { lord: "Mo", from: 2024.45, to: 2025.05 },
      { lord: "Ma", from: 2025.05, to: 2025.45 },
      { lord: "Ra", from: 2025.45, to: 2026.5 },
      { lord: "Ju", from: 2026.5, to: 2027.45, now: true },
      { lord: "Sa", from: 2027.45, to: 2028.55 },
      { lord: "Me", from: 2028.55, to: 2029.5 },
    ],
  };

  // Ecliptic longitude -> point. 0° Aries at 9 o'clock, increasing counter-clockwise.
  function pt(lon, r) {
    const a = Math.PI * (1 + lon / 180);
    return [r * Math.cos(a), -r * Math.sin(a)];
  }
  function arc(l1, l2, r) {
    const [x1, y1] = pt(l1, r),
      [x2, y2] = pt(l2, r);
    const large = (l2 - l1 + 360) % 360 > 180 ? 1 : 0;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  /* ---------- Moon disk with correct terminator ---------- */
  function moonPath(f, waxing, R) {
    const rx = Math.abs(1 - 2 * f) * R;
    const crescent = f < 0.5;
    if (waxing) {
      return `M0 ${-R} A${R} ${R} 0 0 1 0 ${R} A${rx} ${R} 0 0 ${crescent ? 0 : 1} 0 ${-R} Z`;
    }
    return `M0 ${-R} A${R} ${R} 0 0 0 0 ${R} A${rx} ${R} 0 0 ${crescent ? 1 : 0} 0 ${-R} Z`;
  }
  function moonDisk(el, opts = {}) {
    const R = opts.r || 40;
    const svg = s(
      "svg",
      {
        viewBox: `${-R - 4} ${-R - 4} ${2 * R + 8} ${2 * R + 8}`,
        class: "moon-disk",
        role: "img",
        "aria-label": `Moon ${Math.round(DATA.tithi.lit * 100)}% lit, waning`,
      },
      el,
    );
    s("circle", { r: R, class: "moon-dark" }, svg);
    s(
      "path",
      { d: moonPath(DATA.tithi.lit, DATA.tithi.waxing, R), class: "moon-lit" },
      svg,
    );
    s("circle", { r: R, class: "moon-rim" }, svg);
    return svg;
  }

  /* ---------- Sky dial ---------- */
  function skyDial(el, opts = {}) {
    const labels = opts.labels || "glyph";
    const svg = s(
      "svg",
      {
        viewBox: "-215 -215 430 430",
        class: "sky-dial",
        role: "img",
        "aria-label":
          "Today's sky: planets on the zodiac, with your natal Moon marked",
      },
      el,
    );
    const rings = s("g", { class: "dial-rings" }, svg);
    [206, 172, 150, 96].forEach((r, i) =>
      s("circle", { r, class: `ring ring-${i}` }, rings),
    );

    const ticks = s("g", { class: "dial-ticks" }, svg);
    for (let k = 0; k < 12; k++) {
      const [x1, y1] = pt(k * 30, 172),
        [x2, y2] = pt(k * 30, 206);
      s("line", { x1, y1, x2, y2, class: "tick-major" }, ticks);
      const [tx, ty] = pt(k * 30 + 15, 189);
      const t = s(
        "text",
        {
          x: tx,
          y: ty,
          class: "sign",
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        ticks,
      );
      t.textContent = labels === "rashi" ? RASHI[k].slice(0, 3) : GLYPH[k];
    }
    for (let k = 0; k < 27; k++) {
      const lon = k * (360 / 27);
      const [x1, y1] = pt(lon, 162),
        [x2, y2] = pt(lon, 172);
      s("line", { x1, y1, x2, y2, class: "tick-minor" }, ticks);
    }
    const nk = DATA.nakshatraToday,
      w = 360 / 27;
    s("path", { d: arc(nk * w, (nk + 1) * w, 167), class: "nak-today" }, svg);

    // Natal Moon marker and Saturn's pass over it.
    const sat = DATA.planets.find((p) => p.id === "Sa");
    s(
      "path",
      {
        d: arc(
          Math.min(sat.lon, DATA.natalMoon) - 2,
          Math.max(sat.lon, DATA.natalMoon) + 2,
          214 - 6,
        ),
        class: "transit-arc",
      },
      svg,
    );
    const [nx, ny] = pt(DATA.natalMoon, 214 - 6);
    s("circle", { cx: nx, cy: ny, r: 6, class: "natal-moon" }, svg);

    const planets = s("g", { class: "planets" }, svg);
    const groups = DATA.planets.map((p, i) => {
      const r = p.moon ? 128 : 128 - (i % 2) * 22;
      const g = s(
        "g",
        {
          class: `planet p-${p.id}${p.moon ? " is-moon" : ""}`,
          tabindex: 0,
          role: "img",
          "aria-label": `${p.name} in ${SIGNS[Math.floor(p.lon / 30)]}`,
        },
        planets,
      );
      s("circle", { r: p.moon ? 14 : 11, class: "body" }, g);
      const t = s(
        "text",
        {
          class: "glyph",
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        g,
      );
      t.textContent = p.id;
      const place = (lon) => {
        const [x, y] = pt(lon, r);
        g.setAttribute(
          "transform",
          `translate(${x.toFixed(2)} ${y.toFixed(2)})`,
        );
      };
      place(p.lon);
      return { g, p, place };
    });

    if (hasGsap()) {
      gsap.from(svg.querySelectorAll(".ring"), {
        opacity: 0,
        scale: 0.92,
        transformOrigin: "50% 50%",
        duration: 1.2,
        ease: "power2.out",
        stagger: 0.08,
      });
      gsap.from(ticks.querySelectorAll(".tick-minor, .tick-major"), {
        opacity: 0,
        duration: 0.5,
        stagger: 0.012,
        delay: 0.2,
      });
      gsap.from(ticks.querySelectorAll(".sign"), {
        opacity: 0,
        duration: 0.6,
        stagger: 0.04,
        delay: 0.5,
      });
      groups.forEach(({ p, place }, i) => {
        const o = { l: p.lon - 140 };
        place(o.l);
        gsap.to(o, {
          l: p.lon,
          duration: 2.2,
          ease: "power3.out",
          delay: 0.6 + i * 0.07,
          onUpdate: () => place(o.l),
        });
      });
      gsap.from(svg.querySelectorAll(".nak-today, .transit-arc, .natal-moon"), {
        opacity: 0,
        duration: 1,
        delay: 2.4,
      });
    }
    return { svg, groups };
  }

  /* ---------- Day band ---------- */
  function dayBand(el, opts = {}) {
    const a = toMin(DATA.dayStart),
      b = toMin(DATA.dayEnd);
    const pct = (t) => ((toMin(t) - a) / (b - a)) * 100;
    el.classList.add("day-band");
    el.innerHTML = `
      <div class="db-track">
        <div class="db-day" style="left:${pct(DATA.sunrise)}%;width:${pct(DATA.sunset) - pct(DATA.sunrise)}%"></div>
        ${DATA.periods.map((p) => `<div class="db-seg ${p.kind}" style="left:${pct(p.start)}%;width:${pct(p.end) - pct(p.start)}%" title="${p.name} ${p.start}–${p.end}"><span>${p.name}</span></div>`).join("")}
        <div class="db-now" style="left:${pct(DATA.now)}%"><i></i><b>Now ${DATA.nowLabel}</b></div>
      </div>
      <div class="db-axis">
        <span style="left:${pct(DATA.sunrise)}%">Sunrise ${DATA.sunrise}</span>
        <span style="left:${pct("12:00")}%">Noon</span>
        <span style="left:${pct(DATA.sunset)}%">Sunset ${DATA.sunset}</span>
      </div>`;
    if (hasGsap()) {
      const now = el.querySelector(".db-now");
      gsap.from(el.querySelectorAll(".db-seg"), {
        scaleX: 0,
        transformOrigin: "0 50%",
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.08,
        delay: opts.delay || 0.4,
      });
      gsap.fromTo(
        now,
        { left: `${pct(DATA.sunrise)}%`, opacity: 0 },
        {
          left: `${pct(DATA.now)}%`,
          opacity: 1,
          duration: 1.6,
          ease: "power3.inOut",
          delay: (opts.delay || 0.4) + 0.3,
        },
      );
    }
    return el;
  }

  /* ---------- Tithi mala: 30 beads ---------- */
  function tithiMala(el, opts = {}) {
    const mode = opts.mode || "ring";
    const W = opts.width || 420,
      H = mode === "ring" ? W : opts.height || 150;
    const svg = s(
      "svg",
      {
        viewBox: `0 0 ${W} ${H}`,
        class: `tithi-mala mode-${mode}`,
        role: "img",
        "aria-label": `Lunar month: tithi ${DATA.tithi.index} of 30, ${DATA.tithi.name}`,
      },
      el,
    );
    const pts = [];
    for (let i = 0; i < 30; i++) {
      if (mode === "ring") {
        const r = W / 2 - 16,
          a = -Math.PI / 2 + (i / 30) * Math.PI * 2;
        pts.push([W / 2 + r * Math.cos(a), W / 2 + r * Math.sin(a)]);
      } else {
        const x = 18 + (i / 29) * (W - 36);
        const u = (x - W / 2) / (W / 2 - 18);
        pts.push([x, 22 + (1 - u * u) * (H - 54)]);
      }
    }
    if (mode !== "ring") {
      s(
        "path",
        {
          d:
            "M" +
            pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L"),
          class: "mala-thread",
        },
        svg,
      );
    } else {
      s(
        "circle",
        { cx: W / 2, cy: W / 2, r: W / 2 - 16, class: "mala-thread" },
        svg,
      );
    }
    const beads = pts.map(([x, y], i) => {
      const n = i + 1;
      const cls = [
        "bead",
        n < DATA.tithi.index
          ? "past"
          : n === DATA.tithi.index
            ? "today"
            : "future",
        n === 15 ? "purnima" : "",
        n === 30 ? "amavasya" : "",
        n <= 15 ? "shukla" : "krishna",
      ].join(" ");
      const r = n === DATA.tithi.index ? 9 : n === 15 || n === 30 ? 7.5 : 5;
      return s(
        "circle",
        { cx: x.toFixed(1), cy: y.toFixed(1), r, class: cls },
        svg,
      );
    });
    if (hasGsap()) {
      gsap.from(beads, {
        scale: 0,
        transformOrigin: "50% 50%",
        duration: 0.35,
        ease: "back.out(2)",
        stagger: 0.03,
        delay: opts.delay || 0.3,
      });
    }
    return svg;
  }

  /* ---------- Sun arc ---------- */
  function sunArc(el, opts = {}) {
    const W = 640,
      H = 210,
      cx = W / 2,
      cy = H - 26,
      rx = W / 2 - 40,
      ry = H - 60;
    const t0 = toMin(DATA.sunrise),
      t1 = toMin(DATA.sunset);
    const at = (t) => {
      const f = (toMin(t) - t0) / (t1 - t0);
      const a = Math.PI * (1 - f);
      return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)];
    };
    const path = (ta, tb) => {
      const n = 40,
        out = [];
      for (let i = 0; i <= n; i++) {
        const m = toMin(ta) + (i / n) * (toMin(tb) - toMin(ta));
        out.push(at(fmt(m)));
      }
      return (
        "M" + out.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L")
      );
    };
    const svg = s(
      "svg",
      {
        viewBox: `0 0 ${W} ${H}`,
        class: "sun-arc",
        role: "img",
        "aria-label":
          "Today's sun path from sunrise to sunset, with Rahu Kaal marked",
      },
      el,
    );
    s("line", { x1: 20, y1: cy, x2: W - 20, y2: cy, class: "horizon" }, svg);
    s("path", { d: path(DATA.sunrise, DATA.sunset), class: "sun-path" }, svg);
    const elapsed = s(
      "path",
      { d: path(DATA.sunrise, DATA.now), class: "sun-elapsed" },
      svg,
    );
    DATA.periods.forEach((p) =>
      s(
        "path",
        { d: path(p.start, p.end), class: `sun-period ${p.kind}` },
        svg,
      ),
    );
    const [sx, sy] = at(DATA.now);
    const sun = s(
      "g",
      {
        class: "sun",
        transform: `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`,
      },
      svg,
    );
    s("circle", { r: 22, class: "sun-halo" }, sun);
    s("circle", { r: 11, class: "sun-core" }, sun);
    [
      ["sunrise", DATA.sunrise, 20, "start"],
      ["sunset", DATA.sunset, W - 20, "end"],
    ].forEach(([k, t, x, anchor]) => {
      const tx = s(
        "text",
        { x, y: cy + 20, class: "sun-label", "text-anchor": anchor },
        svg,
      );
      tx.textContent = `${k === "sunrise" ? "Sunrise" : "Sunset"} ${t}`;
    });
    if (hasGsap()) {
      const len = elapsed.getTotalLength();
      gsap.fromTo(
        elapsed,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0,
          duration: 1.8,
          ease: "power2.inOut",
          delay: opts.delay || 0.3,
        },
      );
      const o = { m: toMin(DATA.sunrise) };
      gsap.to(o, {
        m: toMin(DATA.now),
        duration: 1.8,
        ease: "power2.inOut",
        delay: opts.delay || 0.3,
        onUpdate: () => {
          const [x, y] = at(fmt(o.m));
          sun.setAttribute(
            "transform",
            `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
          );
        },
      });
    }
    return svg;
  }

  /* ---------- Season strand (dasha) ---------- */
  function seasonStrand(el, opts = {}) {
    const W = 900,
      H = opts.compact ? 70 : 96;
    const a = DATA.birthYear,
      b = 2055.5;
    const x = (y) => 10 + ((y - a) / (b - a)) * (W - 20);
    const svg = s(
      "svg",
      {
        viewBox: `0 0 ${W} ${H}`,
        class: "season-strand",
        role: "img",
        "aria-label":
          "Your dasha seasons from birth; now in Ketu with Jupiter sub-period until mid-2027",
      },
      el,
    );
    const mid = 30;
    s(
      "line",
      { x1: 10, y1: mid, x2: W - 10, y2: mid, class: "strand-base" },
      svg,
    );
    DATA.dasha.forEach((d) => {
      s(
        "line",
        {
          x1: x(d.from) + 3,
          y1: mid,
          x2: x(d.to) - 3,
          y2: mid,
          class: `strand-seg ${d.now ? "now" : ""}`,
        },
        svg,
      );
      const t = s(
        "text",
        {
          x: x(d.from) + 4,
          y: mid - 14,
          class: `strand-label ${d.now ? "now" : ""}`,
        },
        svg,
      );
      t.textContent = d.lord;
      const yr = s(
        "text",
        { x: x(d.from) + 4, y: mid + 26, class: "strand-year" },
        svg,
      );
      yr.textContent = Math.floor(d.from);
    });
    // Zoomed Ketu sub-periods
    if (!opts.compact) {
      const k = DATA.dasha.find((d) => d.now);
      const zx0 = x(k.from),
        zx1 = x(k.to);
      DATA.sub.forEach((sp) => {
        const sx0 = zx0 + ((sp.from - k.from) / (k.to - k.from)) * (zx1 - zx0);
        const sx1 = zx0 + ((sp.to - k.from) / (k.to - k.from)) * (zx1 - zx0);
        s(
          "line",
          {
            x1: sx0 + 1,
            y1: mid + 44,
            x2: sx1 - 1,
            y2: mid + 44,
            class: `strand-sub ${sp.now ? "now" : ""}`,
          },
          svg,
        );
      });
      const jt = s(
        "text",
        { x: zx1 + 8, y: mid + 48, class: "strand-year" },
        svg,
      );
      jt.textContent = "Jupiter sub-period till mid-2027";
      s(
        "line",
        { x1: zx0, y1: mid + 6, x2: zx0, y2: mid + 38, class: "strand-zoom" },
        svg,
      );
      s(
        "line",
        { x1: zx1, y1: mid + 6, x2: zx1, y2: mid + 38, class: "strand-zoom" },
        svg,
      );
    }
    const nx = x(DATA.nowYear);
    const now = s(
      "g",
      { class: "strand-now", transform: `translate(${nx} ${mid})` },
      svg,
    );
    s("circle", { r: 7, class: "now-dot" }, now);
    const nt = s(
      "text",
      { x: 0, y: -26, "text-anchor": "middle", class: "now-label" },
      now,
    );
    nt.textContent = "You, at 31";
    if (hasGsap()) {
      gsap.from(svg.querySelectorAll(".strand-seg"), {
        scaleX: 0,
        transformOrigin: "0 50%",
        duration: 0.9,
        ease: "power2.out",
        stagger: 0.12,
        delay: opts.delay || 0.4,
      });
      gsap.from(now, {
        opacity: 0,
        y: -8,
        duration: 0.8,
        delay: (opts.delay || 0.4) + 0.8,
      });
    }
    return svg;
  }

  /* ---------- Living kundali (North Indian) ---------- */
  const HOUSE_POLY = {
    1: [
      [150, 0],
      [225, 75],
      [150, 150],
      [75, 75],
    ],
    2: [
      [0, 0],
      [150, 0],
      [75, 75],
    ],
    3: [
      [0, 0],
      [75, 75],
      [0, 150],
    ],
    4: [
      [0, 150],
      [75, 75],
      [150, 150],
      [75, 225],
    ],
    5: [
      [0, 150],
      [75, 225],
      [0, 300],
    ],
    6: [
      [0, 300],
      [75, 225],
      [150, 300],
    ],
    7: [
      [150, 300],
      [75, 225],
      [150, 150],
      [225, 225],
    ],
    8: [
      [150, 300],
      [225, 225],
      [300, 300],
    ],
    9: [
      [300, 300],
      [225, 225],
      [300, 150],
    ],
    10: [
      [300, 150],
      [225, 225],
      [150, 150],
      [225, 75],
    ],
    11: [
      [300, 150],
      [225, 75],
      [300, 0],
    ],
    12: [
      [300, 0],
      [225, 75],
      [150, 0],
    ],
  };
  const NATAL_IN = {
    1: ["Me"],
    2: ["Ma"],
    3: ["Ra"],
    4: ["Ju"],
    7: ["Sa"],
    8: ["Mo"],
    9: ["Ke"],
    12: ["Su", "Ve"],
  };
  const lagnaSign = 5; // Leo
  const signOfHouse = (h) => ((lagnaSign - 1 + h - 1) % 12) + 1;
  function transitInHouse() {
    const out = {};
    DATA.planets.forEach((p) => {
      const sign = Math.floor(p.lon / 30) + 1;
      const h = ((sign - lagnaSign + 12) % 12) + 1;
      (out[h] = out[h] || []).push(p.id);
    });
    return out;
  }
  function kundali(el, opts = {}) {
    const svg = s(
      "svg",
      {
        viewBox: "-6 -6 312 312",
        class: "kundali",
        role: "group",
        "aria-label": "Your birth chart. Select a house to read it.",
      },
      el,
    );
    const transit = transitInHouse();
    const centroid = (poly) => [
      poly.reduce((a, p) => a + p[0], 0) / poly.length,
      poly.reduce((a, p) => a + p[1], 0) / poly.length,
    ];
    const houses = {};
    for (let h = 1; h <= 12; h++) {
      const poly = HOUSE_POLY[h];
      const g = s(
        "g",
        {
          class: `house h-${h}${transit[h] ? " touched" : ""}`,
          tabindex: 0,
          role: "button",
          "aria-label": `House ${h}, ${SIGNS[signOfHouse(h) - 1]}`,
        },
        svg,
      );
      s(
        "polygon",
        {
          points: poly.map((p) => p.join(",")).join(" "),
          class: "house-shape",
        },
        g,
      );
      const [cx, cy] = centroid(poly);
      const sn = s(
        "text",
        { x: cx, y: cy - 12, class: "house-sign", "text-anchor": "middle" },
        g,
      );
      sn.textContent = signOfHouse(h);
      const nat = s(
        "text",
        { x: cx, y: cy + 4, class: "house-natal", "text-anchor": "middle" },
        g,
      );
      nat.textContent = (NATAL_IN[h] || []).join(" ");
      if (transit[h]) {
        const tr = s(
          "text",
          {
            x: cx,
            y: cy + 18,
            class: "house-transit",
            "text-anchor": "middle",
          },
          g,
        );
        tr.textContent = transit[h].map((x) => "· " + x).join(" ");
      }
      houses[h] = g;
      const pick = () =>
        opts.onSelect &&
        opts.onSelect(h, {
          sign: SIGNS[signOfHouse(h) - 1],
          natal: NATAL_IN[h] || [],
          transit: transit[h] || [],
        });
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      });
    }
    s("rect", { x: 0, y: 0, width: 300, height: 300, class: "k-frame" }, svg);
    s(
      "path",
      {
        d: "M0 0L300 300M300 0L0 300M150 0L300 150L150 300L0 150Z",
        class: "k-lines",
      },
      svg,
    );
    if (hasGsap()) {
      const lines = svg.querySelectorAll(".k-frame, .k-lines");
      lines.forEach((l) => {
        const len = l.getTotalLength ? l.getTotalLength() : 1200;
        gsap.fromTo(
          l,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 1.6,
            ease: "power2.inOut",
            delay: 0.2,
          },
        );
      });
      gsap.from(svg.querySelectorAll(".house text"), {
        opacity: 0,
        duration: 0.6,
        stagger: 0.03,
        delay: 1.2,
      });
    }
    return { svg, houses, transit, signOfHouse };
  }

  window.AY = {
    DATA,
    SIGNS,
    RASHI,
    NAKS,
    moonDisk,
    skyDial,
    dayBand,
    tithiMala,
    sunArc,
    seasonStrand,
    kundali,
    hasGsap,
    reduce,
  };
})();
