function applySpeedoData(d) {
  if (!d) return;
  const container = document.getElementById('speedoContainer');
  if (container && container.classList.contains('hidden')) {
    container.classList.remove('hidden');
  }

  const speedVal = Number(d.speed ?? d.Speed ?? 0);
  const speedStr = String(Math.max(0, Math.min(999, Math.round(speedVal)))).padStart(3, '0');
  document.getElementById('speedValue').textContent = speedStr;

  const g = String(d.gear ?? d.Gear ?? '1').toUpperCase();
  document.getElementById('gearValue').textContent = (g === 'R' || g === 'N') ? 'GEAR ' + g : 'GEAR ' + g;
  document.getElementById('unitValue').textContent = d.unit || 'KPH';

  let rpmPct = Number(d.rpm ?? d.RPM ?? 0);
  if (rpmPct <= 1 && rpmPct > 0) rpmPct = rpmPct * 100;
  document.getElementById('rpmFill').style.width = Math.max(0, Math.min(100, rpmPct)) + '%';

  const hbkEl = document.getElementById('indHbk');
  const isHbk = Boolean(d.hbk ?? d.handbrake ?? d.Handbrake);
  hbkEl.className = isHbk ? 'ind-text active' : 'ind-text dim';

  const absEl = document.getElementById('indAbs');
  const isAbs = Boolean(d.abs ?? d.ABS ?? d.braking);
  absEl.className = isAbs ? 'ind-text active' : 'ind-text dim';

  const fuel = Math.max(0, Math.min(100, Math.round(Number(d.fuel ?? d.Fuel ?? 100))));
  document.getElementById('fuelText').textContent = fuel + '%';
  document.getElementById('fuelFill').style.width = fuel + '%';

  let rawEng = Number(d.health ?? d.engine ?? d.engineHealth ?? 100);
  if (rawEng > 100) rawEng = (rawEng / 1000) * 100;
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

window.addEventListener('message', function (event) {
  let data = event.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return; }
  }
  if (!data) return;

  if (data.action === 'toggle') {
    const container = document.getElementById('speedoContainer');
    if (data.show) container.classList.remove('hidden');
    else container.classList.add('hidden');
    return;
  }

  applySpeedoData(data);
});