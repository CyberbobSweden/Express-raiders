/* =========================================================================
   EXPRESS RAIDERS  —  ett original western-actionspel
   Inspirerat av arkadklassikern, men all kod och grafik är egen och fri.
   Ritar pixelgrafik proceduralt på canvas. Ingen extern data behövs.
   ========================================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 640 logiska pixlar
  const H = canvas.height;  // 360
  ctx.imageSmoothingEnabled = false;

  // ---- DOM HUD ----
  const hud = document.getElementById("hud");
  const touch = document.getElementById("touch");
  const elScore = document.getElementById("score");
  const elStage = document.getElementById("stage");
  const elLives = document.getElementById("lives");
  const elHealth = document.getElementById("health-fill");

  // ---- Färgpalett ----
  const C = {
    skyTop: "#1a0e2e", skyMid: "#5a2a6e", skyLow: "#b5466a",
    sun: "#ffce5a", sunCore: "#fff2c2",
    dune1: "#7a3f5a", dune2: "#a85a4a", sand: "#c97b3c", sandLit: "#e0a458",
    cactus: "#3e6b3a", cactusLit: "#56904f",
    railTop: "#5a4a52", railWood: "#5a3b28", railWoodDk: "#3f2a1c",
    trainBody: "#3a3a48", trainTrim: "#8a4b2a", trainBolt: "#1c1c26",
    skin: "#e8b88a", skinDk: "#c98f63",
    heroShirt: "#2e6ca8", heroShirtDk: "#1f4d7a", heroHat: "#d8b46a", heroPants: "#43342a",
    banShirt: "#b23a3a", banShirtDk: "#7d2626", banHat: "#222028", banBand: "#e8d24a",
    boss: "#6a3aa8", bossDk: "#472670",
    white: "#f1e4c9", black: "#160b22", blood: "#c1272d", gold: "#ffd23f"
  };

  // =========================================================================
  //  INPUT
  // =========================================================================
  const keys = { left: false, right: false, jump: false, punch: false, kick: false };
  const pressed = { jump: false, punch: false, kick: false }; // edge-triggers

  const keyMap = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
    KeyJ: "punch", KeyZ: "punch",
    KeyK: "kick", KeyX: "kick"
  };

  addEventListener("keydown", (e) => {
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    if (!keys[k]) pressed[k] = true;       // markera ny nedtryckning
    keys[k] = true;
    if (game.state !== "PLAY") anyKey();
  }, { passive: false });

  addEventListener("keyup", (e) => {
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = false;
  }, { passive: false });

  // Touch-knappar
  touch.querySelectorAll(".tbtn").forEach((btn) => {
    const k = btn.dataset.key;
    const on = (e) => { e.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true; if (game.state !== "PLAY") anyKey(); };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener("touchstart", on, { passive: false });
    btn.addEventListener("touchend", off, { passive: false });
    btn.addEventListener("touchcancel", off, { passive: false });
    btn.addEventListener("mousedown", on);
    btn.addEventListener("mouseup", off);
    btn.addEventListener("mouseleave", off);
  });

  // Tap/klick på canvas startar/fortsätter
  canvas.addEventListener("pointerdown", () => { if (game.state !== "PLAY") anyKey(); });

  function consume(k) { if (pressed[k]) { pressed[k] = false; return true; } return false; }

  // =========================================================================
  //  LJUD  (WebAudio – syntade effekter, ingen fil behövs)
  // =========================================================================
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return actx;
  }
  function beep(freq, dur, type = "square", vol = 0.18, slideTo = null) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, vol = 0.2) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), g = a.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g); g.connect(a.destination); s.start();
  }
  const sfx = {
    punch: () => beep(180, 0.08, "square", 0.15, 90),
    kick: () => { beep(120, 0.12, "sawtooth", 0.16, 60); },
    hit: () => { noise(0.12, 0.22); beep(90, 0.1, "square", 0.12, 40); },
    jump: () => beep(300, 0.18, "square", 0.12, 620),
    coin: () => { beep(880, 0.06, "square", 0.14); setTimeout(() => beep(1320, 0.1, "square", 0.14), 60); },
    hurt: () => { noise(0.18, 0.25); beep(160, 0.18, "sawtooth", 0.18, 70); },
    clear: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, "square", 0.16), i * 110)); },
    over: () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, "sawtooth", 0.18), i * 180)); }
  };

  // =========================================================================
  //  SPELOBJEKT
  // =========================================================================
  const GROUND = 300;          // y-nivå där fötter står (tågdäcket)
  const GRAV = 0.7;
  const TOTAL_CARS = 6;        // antal tågvagnar (stages)

  const game = {
    state: "TITLE",            // TITLE | PLAY | CLEAR | OVER | WIN
    score: 0, lives: 3, stage: 1,
    timer: 0, flash: 0, shake: 0,
    enemies: [], particles: [], floats: [],
    toDefeat: 0, defeated: 0,
    scroll: 0, wheelPhase: 0
  };

  const hero = {
    x: 150, y: GROUND, vx: 0, vy: 0, w: 22, h: 40,
    dir: 1, onGround: true, hp: 100, maxHp: 100,
    attack: null, atkT: 0, hurtT: 0, walkPhase: 0, invuln: 0
  };

  function resetHero() {
    hero.x = 150; hero.y = GROUND; hero.vx = 0; hero.vy = 0;
    hero.dir = 1; hero.onGround = true; hero.attack = null; hero.atkT = 0;
    hero.hurtT = 0; hero.invuln = 0;
  }

  function spawnStage() {
    game.enemies = [];
    game.defeated = 0;
    const isBoss = game.stage === TOTAL_CARS;
    game.toDefeat = isBoss ? 1 : 2 + game.stage;
    let spawned = 0;
    const initial = Math.min(isBoss ? 1 : 3, game.toDefeat);
    for (let i = 0; i < initial; i++) { makeEnemy(isBoss && i === 0); spawned++; }
    game._queued = game.toDefeat - spawned;
    game._boss = isBoss;
  }

  function makeEnemy(boss = false) {
    const fromRight = Math.random() < 0.7;
    game.enemies.push({
      x: fromRight ? W + 30 + Math.random() * 120 : -40 - Math.random() * 80,
      y: GROUND, vx: 0, vy: 0,
      w: boss ? 30 : 20, h: boss ? 52 : 38,
      dir: fromRight ? -1 : 1,
      hp: boss ? 14 : 3, maxHp: boss ? 14 : 3,
      boss, onGround: true,
      atkCd: 30 + Math.random() * 40, atkT: 0, attack: false,
      hurtT: 0, walkPhase: Math.random() * 6, speed: boss ? 1.0 : 1.3 + Math.random() * 0.5
    });
  }

  // =========================================================================
  //  HJÄLP
  // =========================================================================
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function addFloat(x, y, text, color = C.gold) { game.floats.push({ x, y, text, color, t: 50 }); }
  function burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) game.particles.push({
      x, y, vx: rnd(-3, 3), vy: rnd(-4, 1), life: rnd(18, 34), color, size: rnd(2, 4)
    });
  }
  function addScore(n, x, y) { game.score += n; if (x != null) addFloat(x, y, "+" + n); }

  // =========================================================================
  //  UPPDATERING
  // =========================================================================
  function update() {
    game.timer++;
    if (game.flash > 0) game.flash--;
    if (game.shake > 0) game.shake--;
    game.wheelPhase += 0.35;

    if (game.state === "PLAY") {
      updatePlay();
    } else if (game.state === "CLEAR") {
      if (game.timer > 120) nextStage();
    } else if (game.state === "OVER" || game.state === "WIN") {
      // väntar på knapp (anyKey)
    }

    updateParticles();
  }

  function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
    for (let i = game.floats.length - 1; i >= 0; i--) {
      const f = game.floats[i]; f.y -= 0.6; f.t--;
      if (f.t <= 0) game.floats.splice(i, 1);
    }
  }

  function updatePlay() {
    const h = hero;

    // ---- rörelse ----
    const speed = 2.6;
    let moving = false;
    if (!h.attack || !h.onGround) {
      if (keys.left)  { h.vx = -speed; h.dir = -1; moving = true; }
      else if (keys.right) { h.vx = speed; h.dir = 1; moving = true; }
      else h.vx = 0;
    } else h.vx = 0;

    if (consume("jump") && h.onGround) { h.vy = -11; h.onGround = false; sfx.jump(); }

    // ---- attacker ----
    if (h.attack) {
      h.atkT--;
      if (h.atkT <= 0) h.attack = null;
    } else {
      if (consume("punch")) { h.attack = "punch"; h.atkT = 12; sfx.punch(); doHeroAttack(14, 1); }
      else if (consume("kick")) { h.attack = "kick"; h.atkT = 18; sfx.kick(); doHeroAttack(22, 2); }
    }

    // fysik
    h.x += h.vx;
    h.vy += GRAV; h.y += h.vy;
    if (h.y >= GROUND) { h.y = GROUND; h.vy = 0; h.onGround = true; }
    h.x = clamp(h.x, 30, W - 30);
    if (moving && h.onGround) h.walkPhase += 0.3; else h.walkPhase = 0;
    if (h.hurtT > 0) h.hurtT--;
    if (h.invuln > 0) h.invuln--;

    // parallax-scroll medan man går
    if (moving) game.scroll += h.dir * 1.4;

    // ---- fiender ----
    for (const e of game.enemies) updateEnemy(e);

    // städa döda + räkna
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (e.hp <= 0 && e.deadT === undefined) { e.deadT = 24; e.vy = -6; e.vx = e.dir * -2; }
      if (e.deadT !== undefined) {
        e.deadT--; e.vy += GRAV; e.y += e.vy; e.x += e.vx; e.vx *= 0.9;
        if (e.deadT <= 0) game.enemies.splice(i, 1);
      }
    }

    // släpp in fler ur kön
    if (game._queued > 0 && game.enemies.filter(e => e.deadT === undefined).length < 3 && game.timer % 70 === 0) {
      makeEnemy(false); game._queued--;
    }

    // stage klar?
    if (game.defeated >= game.toDefeat && game.enemies.length === 0) {
      if (game.stage >= TOTAL_CARS) winGame();
      else stageClear();
    }
  }

  function doHeroAttack(reach, dmg) {
    const h = hero;
    const hx = h.x + h.dir * (h.w / 2 + reach / 2);
    for (const e of game.enemies) {
      if (e.deadT !== undefined) continue;
      if (Math.abs(e.x - hx) < reach && Math.abs(e.y - h.y) < 30) {
        e.hp -= dmg; e.hurtT = 10; e.vx = h.dir * 4; e.atkT = 0; e.attack = false;
        sfx.hit(); burst(e.x, e.y - 20, C.blood, 6);
        game.shake = 5;
        if (e.hp <= 0) {
          const pts = e.boss ? 5000 : 500;
          addScore(pts, e.x, e.y - 40);
          sfx.coin(); game.defeated++;
          burst(e.x, e.y - 20, C.gold, 12);
        }
      }
    }
  }

  function updateEnemy(e) {
    if (e.deadT !== undefined) return;
    const h = hero;
    e.dir = h.x < e.x ? -1 : 1;
    const dist = Math.abs(h.x - e.x);

    if (e.hurtT > 0) { e.hurtT--; }

    // attackcykel
    if (e.attack) {
      e.atkT--;
      if (e.atkT === (e.boss ? 14 : 8)) {
        // träffögonblick
        if (dist < (e.boss ? 40 : 30) && h.invuln <= 0 && Math.abs(h.y - e.y) < 30) {
          hurtHero(e.boss ? 16 : 10, e.dir);
        }
      }
      if (e.atkT <= 0) e.attack = false;
    } else {
      e.atkCd--;
      // rör sig mot hjälten tills nära
      if (dist > (e.boss ? 34 : 26) && e.hurtT <= 0) {
        e.vx = e.dir * e.speed;
        e.walkPhase += 0.25;
      } else {
        e.vx = 0;
        if (e.atkCd <= 0 && e.hurtT <= 0) {
          e.attack = true; e.atkT = e.boss ? 26 : 18; e.atkCd = e.boss ? 50 : 70 + Math.random() * 40;
        }
      }
    }

    e.x += e.vx;
    e.vy += GRAV; e.y += e.vy;
    if (e.y >= GROUND) { e.y = GROUND; e.vy = 0; }
    e.x = clamp(e.x, -60, W + 60);
  }

  function hurtHero(dmg, dir) {
    const h = hero;
    h.hp -= dmg; h.hurtT = 12; h.invuln = 40;
    h.vx = dir * 3; h.x += dir * 6;
    sfx.hurt(); game.shake = 8; game.flash = 6;
    burst(h.x, h.y - 24, C.heroShirt, 6);
    if (h.hp <= 0) loseLife();
    syncHud();
  }

  function loseLife() {
    game.lives--;
    syncHud();
    if (game.lives <= 0) { gameOver(); return; }
    hero.hp = hero.maxHp;
    resetHero();
    hero.invuln = 90;
  }

  // =========================================================================
  //  STATE-ÖVERGÅNGAR
  // =========================================================================
  function startGame() {
    game.state = "PLAY"; game.score = 0; game.lives = 3; game.stage = 1;
    hero.hp = hero.maxHp; resetHero();
    game.particles = []; game.floats = [];
    spawnStage(); game.timer = 0;
    hud.classList.remove("hidden"); touch.classList.remove("hidden");
    syncHud();
  }
  function stageClear() {
    game.state = "CLEAR"; game.timer = 0; sfx.clear();
    addScore(1000);
  }
  function nextStage() {
    game.stage++; game.state = "PLAY"; game.timer = 0;
    hero.hp = Math.min(hero.maxHp, hero.hp + 30);
    resetHero(); spawnStage(); syncHud();
  }
  function gameOver() { game.state = "OVER"; game.timer = 0; sfx.over(); hud.classList.add("hidden"); touch.classList.add("hidden"); }
  function winGame() { game.state = "WIN"; game.timer = 0; sfx.clear(); hud.classList.add("hidden"); touch.classList.add("hidden"); }

  function anyKey() {
    audio();
    if (game.state === "TITLE" || game.state === "OVER" || game.state === "WIN") {
      if (game.timer > 20) startGame();
    }
  }

  function syncHud() {
    elScore.textContent = String(game.score).padStart(6, "0");
    elStage.textContent = game.stage;
    elLives.textContent = game.lives > 0 ? "♥".repeat(game.lives) : "—";
    elHealth.style.width = clamp(hero.hp / hero.maxHp * 100, 0, 100) + "%";
  }

  // =========================================================================
  //  RITNING
  // =========================================================================
  function px(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

  function draw() {
    ctx.save();
    if (game.shake > 0) ctx.translate(rnd(-game.shake, game.shake), rnd(-game.shake, game.shake));

    drawSky();
    drawDunes();
    drawTrain();

    if (game.state === "PLAY" || game.state === "CLEAR") {
      // fiender bakifrån
      const ents = [...game.enemies].sort((a, b) => a.y - b.y);
      for (const e of ents) drawEnemy(e);
      drawHero();
    }

    drawParticles();
    drawFloats();
    ctx.restore();

    if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash / 12})`; ctx.fillRect(0, 0, W, H); }

    if (game.state === "TITLE") drawTitle();
    else if (game.state === "CLEAR") drawBanner(`VAGN ${game.stage} RENSAD!`, "Gör dig redo...");
    else if (game.state === "OVER") drawEnd("SPELET SLUT", "Tryck för att försöka igen");
    else if (game.state === "WIN") drawEnd("TÅGET ÄR DITT!", "Du klarade alla vagnar – tryck för nytt rån");
  }

  // ---- bakgrund ----
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, C.skyTop); g.addColorStop(0.55, C.skyMid); g.addColorStop(1, C.skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    // sol
    const sx = 500, sy = 120;
    ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.sunCore; ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
    // soldränder
    ctx.fillStyle = C.skyMid;
    for (let i = 0; i < 4; i++) ctx.fillRect(sx - 60, sy - 10 + i * 14, 120, 4);
    // stjärnor uppe
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 30; i++) {
      const x = (i * 97 + 13) % W, y = (i * 53) % 90;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawDunes() {
    // fjärran sanddyner (parallax med scroll)
    const s = game.scroll;
    drawDuneLayer(0.2 * s, 230, 38, C.dune1);
    drawDuneLayer(0.4 * s, 250, 30, C.dune2);
    // kaktusar
    for (let i = 0; i < 6; i++) {
      let x = ((i * 130 - 0.5 * s) % (W + 160) + W + 160) % (W + 160) - 80;
      drawCactus(x, 250, 0.7);
    }
  }
  function drawDuneLayer(off, base, amp, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      const y = base + Math.sin((x + off) * 0.012) * amp * 0.4 + Math.sin((x + off) * 0.03) * amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function drawCactus(x, y, sc) {
    px(x, y - 34 * sc, 8 * sc, 34 * sc, C.cactus);
    px(x - 10 * sc, y - 24 * sc, 10 * sc, 6 * sc, C.cactus);
    px(x - 10 * sc, y - 30 * sc, 6 * sc, 10 * sc, C.cactus);
    px(x + 8 * sc, y - 28 * sc, 10 * sc, 6 * sc, C.cactus);
    px(x + 12 * sc, y - 34 * sc, 6 * sc, 12 * sc, C.cactus);
    px(x, y - 34 * sc, 3 * sc, 34 * sc, C.cactusLit);
  }

  // ---- tåg ----
  function drawTrain() {
    // tågdäck (golvet man står på)
    px(0, GROUND, W, 6, C.railTop);
    px(0, GROUND + 6, W, 54, C.trainBody);
    // vagnsskarvar (rör sig med scroll)
    const seg = 80;
    const off = ((game.scroll * 1.4) % seg + seg) % seg;
    ctx.fillStyle = C.black;
    for (let x = -off; x < W; x += seg) px(x, GROUND, 3, 60, C.black);
    // nitar / paneler
    ctx.fillStyle = C.trainBolt;
    for (let x = -off + 10; x < W; x += seg) {
      for (let r = 0; r < 3; r++) { px(x, GROUND + 14 + r * 14, 2, 2, C.trainBolt); px(x + seg - 20, GROUND + 14 + r * 14, 2, 2, C.trainBolt); }
    }
    // trälist
    px(0, GROUND + 6, W, 3, C.trainTrim);
    // hjul
    drawWheels(off, seg);
    // räls/syll under
    px(0, H - 8, W, 8, C.railWoodDk);
    ctx.fillStyle = C.railWood;
    const tieOff = ((game.scroll * 1.4 * 1.6) % 24 + 24) % 24;
    for (let x = -tieOff; x < W; x += 24) px(x, H - 8, 10, 8, C.railWood);
  }
  function drawWheels(off, seg) {
    for (let x = -off + seg / 2; x < W; x += seg) {
      const wy = GROUND + 56;
      ctx.fillStyle = C.trainBolt;
      ctx.beginPath(); ctx.arc(x, wy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#55555f";
      ctx.beginPath(); ctx.arc(x, wy, 6, 0, Math.PI * 2); ctx.fill();
      // ekrar
      ctx.strokeStyle = C.trainBolt; ctx.lineWidth = 2;
      ctx.beginPath();
      const ph = game.wheelPhase;
      for (let k = 0; k < 4; k++) {
        const a = ph + k * Math.PI / 2;
        ctx.moveTo(x, wy); ctx.lineTo(x + Math.cos(a) * 6, wy + Math.sin(a) * 6);
      }
      ctx.stroke();
    }
  }

  // ---- hjälte ----
  function drawHero() {
    const h = hero;
    if (h.invuln > 0 && Math.floor(h.invuln / 4) % 2 === 0) return; // blink
    const x = h.x, y = h.y, d = h.dir;
    const bob = h.onGround ? Math.sin(h.walkPhase) * 1.5 : 0;
    drawCowboy(x, y + bob, d, {
      shirt: C.heroShirt, shirtDk: C.heroShirtDk, hat: C.heroHat, pants: C.heroPants,
      attack: h.attack, walk: h.walkPhase, jump: !h.onGround, hurt: h.hurtT > 0
    });
  }
  function drawEnemy(e) {
    const dying = e.deadT !== undefined;
    const opts = {
      shirt: e.boss ? C.boss : C.banShirt, shirtDk: e.boss ? C.bossDk : C.banShirtDk,
      hat: C.banHat, pants: "#2a2230", band: C.banBand,
      attack: e.attack ? "punch" : null, walk: e.walkPhase, jump: false,
      hurt: e.hurtT > 0, dying, scale: e.boss ? 1.35 : 1, bandit: true
    };
    drawCowboy(e.x, e.y, e.dir, opts);
    // hälsa-pip ovanför boss
    if (e.boss && !dying) {
      px(e.x - 20, e.y - 70, 40, 5, C.black);
      px(e.x - 19, e.y - 69, 38 * (e.hp / e.maxHp), 3, C.blood);
    }
  }

  // Ritar en cowboy i pixelstil. Hjälte och bandit delar samma rigg.
  function drawCowboy(cx, cy, dir, o) {
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    if (o.dying) ctx.rotate(0.35 * (1 - (o.deadT || 0)));
    if (o.scale) ctx.scale(s, s);

    const skin = o.bandit ? C.skinDk : C.skin;
    const P = (x, y, w, h, c) => px(x, y, w, h, c);

    // skugga
    ctx.globalAlpha = 0.3; P(-12, -2, 24, 4, C.black); ctx.globalAlpha = 1;

    // ben
    const legSwing = o.jump ? 6 : Math.sin(o.walk || 0) * 5;
    P(-8, -16, 6, 16, o.pants);                 // bakben
    P(2 + legSwing * 0.3, -16, 6, 16, o.pants);  // framben
    P(-9, -2, 8, 3, C.black); P(2, -2, 8, 3, C.black); // stövlar

    // kropp
    P(-9, -38, 18, 24, o.hurt ? C.white : o.shirt);
    P(-9, -38, 18, 5, o.shirtDk);                // axelparti
    P(-9, -26, 18, 3, o.shirtDk);                // bälte-skugga
    P(-3, -22, 6, 4, C.gold);                    // bältesspänne

    // bandit-bandana
    if (o.band) P(-6, -44, 12, 4, o.band);

    // huvud
    P(-6, -50, 12, 12, skin);
    P(2, -47, 2, 2, C.black);                    // öga
    if (o.bandit) P(-6, -46, 12, 4, o.band);     // ansiktsmask

    // hatt
    P(-9, -54, 18, 3, o.hat);                    // brätte
    P(-6, -60, 12, 7, o.hat);                    // krona
    P(-6, -55, 12, 2, o.bandit ? "#000" : C.heroShirtDk); // hattband

    // arm / attack
    if (o.attack === "punch") {
      P(6, -36, 16, 5, o.shirt); P(20, -37, 5, 6, skin);  // utsträckt slag
    } else if (o.attack === "kick") {
      P(6, -16, 18, 6, o.pants); P(22, -16, 6, 5, C.black); // utsträckt spark
    } else {
      const armSwing = Math.sin((o.walk || 0) + Math.PI) * 3;
      P(5, -36, 5, 14 + armSwing, o.shirt); P(5, -24 + armSwing, 5, 4, skin);
    }

    ctx.restore();
  }

  // ---- partiklar / text ----
  function drawParticles() {
    for (const p of game.particles) { ctx.globalAlpha = clamp(p.life / 20, 0, 1); px(p.x, p.y, p.size, p.size, p.color); }
    ctx.globalAlpha = 1;
  }
  function drawFloats() {
    ctx.textAlign = "center";
    for (const f of game.floats) {
      ctx.globalAlpha = clamp(f.t / 20, 0, 1);
      ctx.font = "bold 14px 'Special Elite', monospace";
      ctx.fillStyle = C.black; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = "start";
  }

  // ---- skärmar ----
  function drawTitle() {
    ctx.fillStyle = "rgba(10,5,16,0.45)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    // titel
    ctx.font = "44px 'Rye', serif";
    ctx.fillStyle = C.black; ctx.fillText("EXPRESS", W / 2 + 3, 120 + 3);
    ctx.fillStyle = C.gold;  ctx.fillText("EXPRESS", W / 2, 120);
    ctx.fillStyle = C.black; ctx.fillText("RAIDERS", W / 2 + 3, 168 + 3);
    ctx.fillStyle = C.blood; ctx.fillText("RAIDERS", W / 2, 168);

    // undertitel
    ctx.font = "13px 'Special Elite', monospace";
    ctx.fillStyle = C.white;
    ctx.fillText("Rensa tåget från banditer – vagn för vagn", W / 2, 200);

    if (Math.floor(game.timer / 30) % 2 === 0) {
      ctx.font = "16px 'Rye', serif"; ctx.fillStyle = C.sun;
      ctx.fillText("TRYCK FÖR ATT STARTA", W / 2, 250);
    }
    // kontroller
    ctx.font = "11px 'Special Elite', monospace"; ctx.fillStyle = "rgba(241,228,201,0.8)";
    ctx.fillText("◀ ▶ gå   ·   ↑/MELLANSLAG hoppa   ·   J slag   ·   K spark", W / 2, 282);
    ctx.fillText("(på mobil: knappar på skärmen)", W / 2, 298);
    ctx.textAlign = "start";
  }

  function drawBanner(title, sub) {
    ctx.fillStyle = "rgba(10,5,16,0.55)"; ctx.fillRect(0, 120, W, 90);
    ctx.textAlign = "center";
    ctx.font = "30px 'Rye', serif";
    ctx.fillStyle = C.black; ctx.fillText(title, W / 2 + 2, 162 + 2);
    ctx.fillStyle = C.gold; ctx.fillText(title, W / 2, 162);
    ctx.font = "13px 'Special Elite', monospace"; ctx.fillStyle = C.white;
    ctx.fillText(sub, W / 2, 190);
    ctx.textAlign = "start";
  }

  function drawEnd(title, sub) {
    ctx.fillStyle = "rgba(10,5,16,0.65)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "40px 'Rye', serif";
    ctx.fillStyle = C.black; ctx.fillText(title, W / 2 + 3, 150 + 3);
    ctx.fillStyle = title === "SPELET SLUT" ? C.blood : C.gold; ctx.fillText(title, W / 2, 150);
    ctx.font = "16px 'Special Elite', monospace"; ctx.fillStyle = C.white;
    ctx.fillText("Poäng: " + String(game.score).padStart(6, "0"), W / 2, 190);
    if (Math.floor(game.timer / 30) % 2 === 0) {
      ctx.font = "14px 'Rye', serif"; ctx.fillStyle = C.sun;
      ctx.fillText(sub, W / 2, 232);
    }
    ctx.textAlign = "start";
  }

  // =========================================================================
  //  LOOP
  // =========================================================================
  let last = 0, acc = 0; const STEP = 1000 / 60;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!last) last = t;
    acc += t - last; last = t;
    if (acc > 250) acc = 250;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw();
  }
  requestAnimationFrame(loop);

})();
