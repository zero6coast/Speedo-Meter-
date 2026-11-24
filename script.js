// =========================================================================
// JGVRP HOLOGRAM SPEEDOMETER — NATIVE DOM OBSERVER & TELEMETRY SYNC
// =========================================================================

function parseNumeric(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function updateHologramUI(data) {
  if (!data) return;

  // 1. Kecepatan (Speed 3 Digit: e.g. 014)
  if (data.speed !== null && data.speed !== undefined) {
    const spd = Math.max(0, Math.min(999, Math.round(data.speed)));
    document.getElementById('speedValue').textContent = String(spd).padStart(3, '0');
  }

  // 2. Satuan (KPH / MPH)
  if (data.unit) {
    document.getElementById('unitValue').textContent = data.unit;
  }

  // 3. Gear (GEAR 1, R, N, dll.)
  if (data.gear !== null && data.gear !== undefined && data.gear !== '') {
    let g = String(data.gear).trim().toUpperCase();
    if (g === '0') g = (data.speed && data.speed > 0) ? 'R' : 'N';
    document.getElementById('gearValue').textContent = 'GEAR ' + g;
  }

  // 4. RPM Bar (JGVRP mengirim RPM dalam skala 0 - 8000 atau 0.0 - 1.0)
  if (data.rpm !== null && data.rpm !== undefined) {
    let rpmPct = data.rpm;
    if (rpmPct > 100) {
      rpmPct = (rpmPct / 8000) * 100;
    } else if (rpmPct > 0 && rpmPct <= 1.05) {
      rpmPct = rpmPct * 100;
    }
    rpmPct = Math.max(0, Math.min(100, rpmPct));
    const rpmFill = document.getElementById('rpmFill');
    rpmFill.style.width = rpmPct + '%';
    if (rpmPct >= 88) {
      rpmFill.style.background = '#ff3b4e';
      rpmFill.style.boxShadow = '0 0 12px rgba(255, 59, 78, 0.95)';
    } else {
      rpmFill.style.background = '#ffffff';
      rpmFill.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.95)';
    }
  }

  // 5. Bensin / Fuel (0 - 100%)
  if (data.fuel !== null && data.fuel !== undefined) {
    let fuel = data.fuel;
    if (fuel > 0 && fuel <= 1) fuel = fuel * 100;
    fuel = Math.max(0, Math.min(100, Math.round(fuel)));
    document.getElementById('fuelText').textContent = fuel + '%';
    document.getElementById('fuelFill').style.width = fuel + '%';
  }

  // 6. Health Kendaraan / Engine (0 - 100% atau 0 - 1000)
  if (data.health !== null && data.health !== undefined) {
    let hp = data.health;
    if (hp > 100) hp = (hp / 1000) * 100;
    else if (hp > 0 && hp <= 1) hp = hp * 100;
    hp = Math.max(0, Math.min(100, Math.round(hp)));

    document.getElementById('healthText').textContent = hp + '%';
    const hpFill = document.getElementById('healthFill');
    const engLabel = document.getElementById('engLabel');
    hpFill.style.width = hp + '%';

    if (hp <= 30) {
      hpFill.style.background = '#ff3b4e';
      engLabel.className = 'stat-label red';
    } else if (hp <= 60) {
      hpFill.style.background = '#fbbf24';
      engLabel.className = 'stat-label amber';
    } else {
      hpFill.style.background = '#22ff66';
      engLabel.className = 'stat-label green';
    }
  }

  // 7. Indikator HBK (Handbrake / Engine Off) & ABS (Braking)
  if (data.hbk !== undefined) {
    document.getElementById('indHbk').className = data.hbk ? 'ind-text active' : 'ind-text dim';
  }
  if (data.abs !== undefined) {
    document.getElementById('indAbs').className = data.abs ? 'ind-text active' : 'ind-text dim';
  }
}

// =========================================================================
// PEMBACA DATA LANGSUNG DARI ELEMEN TERSEMBUNYI JGVRP (<dd id='...'>)
// =========================================================================
let lastSpeed = 0;

function readJgvrpDomSource() {
  const speedEl = document.getElementById('speed');
  const rpmEl = document.getElementById('rpm');
  const fuelEl = document.getElementById('fuel');
  const healthEl = document.getElementById('health');
  const gearEl = document.getElementById('gear');
  const engineEl = document.getElementById('engine');

  if (!speedEl) return;

  const rawSpeedText = speedEl.textContent.trim();
  const speedNum = parseNumeric(rawSpeedText);
  const rpmNum = rpmEl ? parseNumeric(rpmEl.textContent) : null;
  const fuelNum = fuelEl ? parseNumeric(fuelEl.textContent) : null;
  const healthNum = healthEl ? parseNumeric(healthEl.textContent) : null;
  const gearText = gearEl ? gearEl.textContent.trim() : '';
  const engineText = engineEl ? engineEl.textContent.trim().toLowerCase() : '';

  // Deteksi satuan otomatis dari teks kecepatan JGVRP (km/h, kph, atau mph)
  let detectedUnit = 'KPH';
  if (/mph/i.test(rawSpeedText)) detectedUnit = 'MPH';

  // Deteksi HBK aktif jika mobil berhenti & mesin mati / parkir, ABS jika deselerasi cepat
  const isEngineOff = (engineText === 'off' || engineText === 'false' || engineText === '0');
  const isHbk = isEngineOff || ((speedNum === 0) && (rpmNum !== null && rpmNum < 950));
  const isAbs = (speedNum !== null && lastSpeed - speedNum >= 6 && speedNum > 15);
  if (speedNum !== null) lastSpeed = speedNum;

  updateHologramUI({
    speed: speedNum,
    unit: detectedUnit,
    rpm: rpmNum,
    fuel: fuelNum,
    health: healthNum,
    gear: gearText,
    hbk: isHbk,
    abs: isAbs
  });
}

// Jalankan loop pembacaan halus (60 FPS) & MutationObserver pada .data-source
function startJgvrpSync() {
  const dataSource = document.querySelector('.data-source');
  if (dataSource) {
    const observer = new MutationObserver(readJgvrpDomSource);
    observer.observe(dataSource, { childList: true, subtree: true, characterData: true });
  }
  setInterval(readJgvrpDomSource, 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startJgvrpSync);
} else {
  startJgvrpSync();
}

// Tetap dukung postMessage jika server mengirim event JSON tambahan
window.addEventListener('message', function (event) {
  let d = event.data;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (e) { return; }
  }
  if (!d || typeof d !== 'object') return;
  const payload = d.data || d.payload || d;
  updateHologramUI({
    speed: parseNumeric(payload.speed ?? payload.Speed),
    rpm: parseNumeric(payload.rpm ?? payload.RPM),
    fuel: parseNumeric(payload.fuel ?? payload.Fuel),
    health: parseNumeric(payload.health ?? payload.Health ?? payload.engineHealth),
    gear: payload.gear ?? payload.Gear,
    hbk: payload.hbk ?? payload.handbrake,
    abs: payload.abs ?? payload.braking
  });
});
