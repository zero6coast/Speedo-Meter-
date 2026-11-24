// =========================================================================
// JGVRP OFFICIAL SPEEDOMETER API — 3D HOLOGRAM (BELT, LAMP & SIGNALS)
// =========================================================================
let speedMode = 0;
let lastRawSpeedMs = 0;
let currentSpeedConverted = 0;
let isEngineOn = false;
let isSeatbeltOn = false;
let chimeAudioCtx = null;
let chimeTimer = null;

// Bunyi chime peringatan seatbelt khas Porsche Macan/992/Taycan (Web Audio API)
function playSeatbeltChime() {
  if (isSeatbeltOn || (!isEngineOn && currentSpeedConverted <= 0)) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!chimeAudioCtx) chimeAudioCtx = new AudioCtx();
    if (chimeAudioCtx.state === 'suspended') chimeAudioCtx.resume();

    const now = chimeAudioCtx.currentTime;
    const notes = [
      { t: 0.00, f1: 659.25, f2: 1318.51, dur: 0.42, vol: 0.14 },
      { t: 0.22, f1: 493.88, f2: 987.77,  dur: 0.42, vol: 0.13 },
      { t: 0.44, f1: 415.30, f2: 830.61,  dur: 0.46, vol: 0.13 },
      { t: 0.72, f1: 659.25, f2: 987.77,  dur: 0.85, vol: 0.15 }
    ];

    notes.forEach((n) => {
      [n.f1, n.f2].forEach((freq, idx) => {
        const osc = chimeAudioCtx.createOscillator();
        const gain = chimeAudioCtx.createGain();
        const filter = chimeAudioCtx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + n.t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now + n.t);

        const peak = idx === 0 ? n.vol : n.vol * 0.38;
        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.linearRampToValueAtTime(peak, now + n.t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(chimeAudioCtx.destination);

        osc.start(now + n.t);
        osc.stop(now + n.t + n.dur + 0.03);
      });
    });
  } catch (e) {}
}

function syncSeatbeltChimeLoop() {
  const shouldWarn = !isSeatbeltOn && (isEngineOn || currentSpeedConverted > 0);
  if (shouldWarn && !chimeTimer) {
    playSeatbeltChime();
    chimeTimer = setInterval(playSeatbeltChime, 2400);
  } else if (!shouldWarn && chimeTimer) {
    clearInterval(chimeTimer);
    chimeTimer = null;
  }
}

function updateSeatbeltIndicator() {
  const beltEl = document.getElementById('indBelt');
  if (!beltEl) return;
  if (isSeatbeltOn) {
    beltEl.className = 'ind-text green';
  } else if (isEngineOn || currentSpeedConverted > 0) {
    beltEl.className = 'ind-text warn';
  } else {
    beltEl.className = 'ind-text dim';
  }
  syncSeatbeltChimeLoop();
}

function setEngine(state) {
  isEngineOn = Boolean(state);
  updateSeatbeltIndicator();
}

function setSpeed(speed) {
  const rawMs = Number(speed) || 0;
  let converted = 0;
  let unitLabel = 'KPH';

  switch (speedMode) {
    case 1: converted = Math.round(rawMs * 2.236936); unitLabel = 'MPH'; break;
    case 2: converted = Math.round(rawMs * 1.943844); unitLabel = 'KTS'; break;
    default: converted = Math.round(rawMs * 3.6); unitLabel = 'KPH'; break;
  }

  lastRawSpeedMs = rawMs;
  currentSpeedConverted = Math.max(0, Math.min(999, converted));

  const speedEl = document.getElementById('speedValue');
  const unitEl = document.getElementById('unitValue');
  if (speedEl) speedEl.textContent = String(currentSpeedConverted).padStart(3, '0');
  if (unitEl) unitEl.textContent = unitLabel;

  updateSeatbeltIndicator();
}

function setRPM(rpm) {
  let val = Number(rpm) || 0;
  let pct = val <= 1.2 ? val * 100 : (val / 8000) * 100;
  pct = Math.max(0, Math.min(100, pct));

  const rpmFill = document.getElementById('rpmFill');
  if (!rpmFill) return;
  rpmFill.style.width = pct + '%';
  rpmFill.style.background = pct >= 88 ? '#ff3b4e' : '#ffffff';
  rpmFill.style.boxShadow = pct >= 88 ? '0 0 12px rgba(255,59,78,0.95)' : '0 0 12px rgba(255,255,255,0.95)';
}

function setFuel(fuel) {
  let val = Number(fuel) || 0;
  let pct = Math.max(0, Math.min(100, Math.round(val <= 1.05 ? val * 100 : val)));
  const fuelText = document.getElementById('fuelText');
  if (fuelText) fuelText.textContent = pct + '%';
}

function setHealth(health) {
  let val = Number(health) || 0;
  let pct = Math.max(0, Math.min(100, Math.round(val <= 1.05 ? val * 100 : (val > 100 ? (val / 1000) * 100 : val))));
  const healthText = document.getElementById('healthText');
  const engLabel = document.getElementById('engLabel');
  if (healthText) healthText.textContent = pct + '%';
  if (engLabel) {
    if (pct <= 30) engLabel.className = 'mini-stat red';
    else if (pct <= 60) engLabel.className = 'mini-stat amber';
    else engLabel.className = 'mini-stat green';
  }
}

function setGear(gear) {
  const gearEl = document.getElementById('gearValue');
  if (!gearEl) return;
  let g = String(gear).trim().toUpperCase();
  if (g === '0') g = currentSpeedConverted > 0 ? 'R' : 'N';
  gearEl.textContent = 'GEAR ' + g;
  gearEl.className = (g === 'R') ? 'gear-text reverse' : 'gear-text';
}

function setHeadlights(state) {
  const lampEl = document.getElementById('indLamp');
  if (!lampEl) return;
  if (state === 2) lampEl.className = 'ind-text cyan';
  else if (state === 1) lampEl.className = 'ind-text green';
  else lampEl.className = 'ind-text dim';
}

function setLeftIndicator(state) {
  const leftEl = document.getElementById('indLeft');
  if (leftEl) leftEl.className = state ? 'turn-arrow active' : 'turn-arrow dim';
}

function setRightIndicator(state) {
  const rightEl = document.getElementById('indRight');
  if (rightEl) rightEl.className = state ? 'turn-arrow active' : 'turn-arrow dim';
}

function setSeatbelts(state) {
  isSeatbeltOn = Boolean(state);
  updateSeatbeltIndicator();
}

function setSpeedMode(mode) {
  speedMode = Number(mode) || 0;
  setSpeed(lastRawSpeedMs);
}

function setOdometer(distance) {
  const odoEl = document.getElementById('odoText');
  if (odoEl) odoEl.textContent = (Number(distance) || 0).toFixed(1).padStart(6, '0') + ' MI';
}

window.setEngine = setEngine;
window.setSpeed = setSpeed;
window.setRPM = setRPM;
window.setFuel = setFuel;
window.setHealth = setHealth;
window.setGear = setGear;
window.setHeadlights = setHeadlights;
window.setLeftIndicator = setLeftIndicator;
window.setRightIndicator = setRightIndicator;
window.setSeatbelts = setSeatbelts;
window.setSpeedMode = setSpeedMode;
window.setOdometer = setOdometer;
