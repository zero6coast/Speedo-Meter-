// Universal Parser: Mendukung format data langsung maupun nested (data / payload / vehicle)
function extractVehicleMetrics(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Jika server membungkus data di dalam properti data, payload, vehicle, atau detail
  const nested = raw.data || raw.payload || raw.vehicle || raw.stats || raw.detail;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return Object.assign({}, raw, nested);
  }
  return raw;
}

function applySpeedoData(rawInput) {
  const d = extractVehicleMetrics(rawInput);
  if (!d) return;

  const container = document.getElementById('speedoContainer');
  if (container && container.classList.contains('hidden')) {
    container.classList.remove('hidden');
  }

  // 1. Kecepatan (Mendukung speed, Speed, velocity, kmh, kph, mph)
  let speedVal = d.speed ?? d.Speed ?? d.kmh ?? d.kph ?? d.mph ?? d.velocity;
  if (speedVal !== undefined && speedVal !== null) {
    speedVal = Number(speedVal);
    // Jika server mengirim m/s mentah (biasanya ada flag isMs atau unit m/s)
    if (d.unit === 'ms' || d.unit === 'm/s') speedVal = speedVal * 3.6;
    const speedStr = String(Math.max(0, Math.min(999, Math.round(speedVal)))).padStart(3, '0');
    document.getElementById('speedValue').textContent = speedStr;
  }

  // 2. Gear (Mendukung gear, Gear, currentGear)
  const rawGear = d.gear ?? d.Gear ?? d.currentGear;
  if (rawGear !== undefined && rawGear !== null) {
    const g = String(rawGear).toUpperCase();
    const gearLabel = (g === '0' && Number(speedVal || 0) > 0) ? 'R' : (g === '0' ? 'N' : g);
    document.getElementById('gearValue').textContent = 'GEAR ' + gearLabel;
  }

  // 3. Satuan KPH / MPH
  if (d.unit || d.speedUnit || d.isMph !== undefined) {
    const unitText = d.unit || d.speedUnit || (d.isMph ? 'MPH' : 'KPH');
    document.getElementById('unitValue').textContent = String(unitText).toUpperCase();
  }

  // 4. RPM (Mendukung skala 0.0-1.0 maupun 0-100 atau 0-10000)
  const rawRpm = d.rpm ?? d.RPM ?? d.currentRpm;
  if (rawRpm !== undefined && rawRpm !== null) {
    let rpmPct = Number(rawRpm);
    if (rpmPct > 0 && rpmPct <= 1.05) rpmPct = rpmPct * 100;
    else if (rpmPct > 100) rpmPct = (rpmPct / 10000) * 100;
    document.getElementById('rpmFill').style.width = Math.max(0, Math.min(100, rpmPct)) + '%';
  }

  // 5. Indikator HBK (Handbrake) & ABS
  const hbkVal = d.hbk ?? d.handbrake ?? d.Handbrake ?? d.brake;
  if (hbkVal !== undefined) {
    document.getElementById('indHbk').className = Boolean(hbkVal) ? 'ind-text active' : 'ind-text dim';
  }

  const absVal = d.abs ?? d.ABS ?? d.braking ?? d.isBraking;
  if (absVal !== undefined) {
    document.getElementById('indAbs').className = Boolean(absVal) ? 'ind-text active' : 'ind-text dim';
  }

  // 6. Bensin / Fuel (Mendukung fuel, Fuel, fuelLevel, petrol)
  const rawFuel = d.fuel ?? d.Fuel ?? d.fuelLevel ?? d.petrol;
  if (rawFuel !== undefined && rawFuel !== null) {
    let fuel = Number(rawFuel);
    if (fuel > 0 && fuel <= 1) fuel = fuel * 100;
    fuel = Math.max(0, Math.min(100, Math.round(fuel)));
    document.getElementById('fuelText').textContent = fuel + '%';
    document.getElementById('fuelFill').style.width = fuel + '%';
  }

  // 7. Health Kendaraan / Engine (Mendukung health, engine, engineHealth, bodyHealth, vehicleHealth)
  const rawEngInput = d.health ?? d.engine ?? d.engineHealth ?? d.vehicleHealth ?? d.bodyHealth;
  if (rawEngInput !== undefined && rawEngInput !== null) {
    let rawEng = Number(rawEngInput);
    if (rawEng > 100) rawEng = (rawEng / 1000) * 100;
    else if (rawEng > 0 && rawEng <= 1) rawEng = rawEng * 100;
    const hp = Math.max(0, Math.min(100, Math.round(rawEng)));
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
}

// Listener utama untuk pesan postMessage dari JGVRP / FiveM NUI
window.addEventListener('message', function (event) {
  let data = event.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return; }
  }
  if (!data) return;

  const msgType = data.action || data.type || data.event;
  if (msgType === 'toggle' || msgType === 'setVisible' || msgType === 'show') {
    const container = document.getElementById('speedoContainer');
    const isVisible = data.show ?? data.visible ?? data.status ?? true;
    if (isVisible) container.classList.remove('hidden');
    else container.classList.add('hidden');
    return;
  }

  applySpeedoData(data);
});

// Ekspos fungsi global jika JGVRP memanggil fungsi JS langsung di dalam iframe/CEF
window.updateSpeedometer = applySpeedoData;
window.updateHUD = applySpeedoData;
window.setSpeedoData = applySpeedoData;
