// =========================================================================
// JGVRP OFFICIAL SPEEDOMETER API — 3D HOLOGRAM (PORSCHE SEATBELT CHIME)
// =========================================================================
let speedMode = 0;
let lastRawSpeedMs = 0;
let currentSpeedConverted = 0;
let isEngineOn = false;
let isSeatbeltOn = false;
let chimeAudioEl = null;
let chimeAudioCtx = null;
let chimeTimer = null;

// Membangkitkan file WAV chime Porsche Macan/992/Taycan secara langsung di memori
// Menggunakan elemen <audio> agar tidak diblokir autoplay CEF FiveM / JGVRP
function buildPorscheChimeWavUrl() {
  const sampleRate = 22050;
  const duration = 1.65;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const notes = [
    { start: 0.00, dur: 0.42, f1: 659.25, f2: 1318.51, amp: 0.28 },
    { start: 0.22, dur: 0.42, f1: 493.88, f2: 987.77,  amp: 0.26 },
    { start: 0.44, dur: 0.46, f1: 415.30, f2: 830.61,  amp: 0.26 },
    { start: 0.72, dur: 0.88, f1: 659.25, f2: 987.77,  amp: 0.30 }
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (let n = 0; n < notes.length; n++) {
      const note = notes[n];
      const dt = t - note.start;
      if (dt >= 0 && dt <= note.dur) {
        const attack = Math.min(1, dt / 0.015);
        const decay = Math.exp(-dt * (n === 3 ? 3.8 : 6.2));
        const env = attack * decay * note.amp;
        const wave = Math.sin(2 * Math.PI * note.f1 * dt) + 0.35 * Math.sin(2 * Math.PI * note.f2 * dt);
        sample += wave * env;
      }
    }
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function ensureChimeAudio() {
  if (!chimeAudioEl) {
    chimeAudioEl = new Audio(buildPorscheChimeWavUrl());
    chimeAudioEl.volume = 0.85;
  }
}

function unlockAudioContext() {
  ensureChimeAudio();
  if (chimeAudioCtx && chimeAudioCtx.state === 'suspended') {
    chimeAudioCtx.resume().catch(() => {});
  }
}
['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, unlockAudioContext, { passive: true });
});

function playSeatbeltChime() {
  if (isSeatbeltOn) return;
  try {
    ensureChimeAudio();
    chimeAudioEl.currentTime = 0;
    const playPromise = chimeAudioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Fallback Web Audio API jika <audio> ditahan
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!chimeAudioCtx) chimeAudioCtx = new AudioCtx();
        if (chimeAudioCtx.state === 'suspended') chimeAudioCtx.resume();
        const now = chimeAudioCtx.currentTime;
        [659.25, 493.88, 415.30, 659.25].forEach((freq, idx) => {
          const osc = chimeAudioCtx.createOscillator();
          const gain = chimeAudioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.22);
          gain.gain.setValueAtTime(0.001, now + idx * 0.22);
          gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.22 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.45);
          osc.connect(gain);
          gain.connect(chimeAudioCtx.destination);
          osc.start(now + idx * 0.22);
          osc.stop(now + idx * 0.22 + 0.48);
        });
      });
    }
  } catch (e) {}
}

function syncSeatbeltChimeLoop() {
  // Bunyikan alarm saat seatbelt lepas dan kendaraan aktif / bergerak / baru dimuat
  const shouldWarn = !isSeatbeltOn && (isEngineOn || currentSpeedConverted > 0);
  if (shouldWarn && !chimeTimer) {
    playSeatbeltChime();
    chimeTimer = setInterval(playSeatbeltChime, 2300);
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
  } else {
    beltEl.className = 'ind-text warn';
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

document.addEventListener('DOMContentLoaded', () => {
  ensureChimeAudio();
  updateSeatbeltIndicator();
});

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
