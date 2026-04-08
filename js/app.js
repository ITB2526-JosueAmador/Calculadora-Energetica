/* ============================================================
   ITB LEAKS — INDICADORS DE SOSTENIBILITAT
   app.js — Lògica principal, càlculs i visualitzacions
   ============================================================ */

// ---- DADES GLOBALS ----
let DATA = null;

// Factors estacionals mensuals (1.0 = base)
const SEASONAL = {
  electric: [1.30, 1.25, 1.05, 0.90, 0.85, 0.80, 0.80, 0.82, 0.95, 1.05, 1.20, 1.35],
  water:    [0.75, 0.72, 0.80, 0.90, 1.05, 1.15, 1.35, 1.30, 1.05, 0.90, 0.78, 0.75],
  office:   [1.10, 1.10, 1.05, 0.90, 1.00, 0.95, 0.50, 0.50, 1.10, 1.15, 1.10, 0.55],
  cleaning: [1.05, 1.00, 1.05, 1.00, 1.05, 1.10, 0.70, 0.70, 1.10, 1.10, 1.05, 1.10],
};

const MONTHS_CA = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];
const MONTHS_FULL = ['Gener','Febrer','Març','Abril','Maig','Juny',
                     'Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

// Costos reals extretes del JSON (estimats per categoria)
const BASE_COSTS = {
  electric: 2548.02 / 12,    // F046 instal·lació elèctrica / anualitzada
  water:    454.72 / 12,     // F056 neteja jardí (referència aigua)
  office:   771.29 / 12,     // total Material Oficina / 12
  cleaning: 1204.98 / 12,    // total Neteges i Subministraments / 12
};

// ---- CÀRREGA DADES ----
async function loadData() {
  try {
    // Si dataclean.json está en la misma carpeta que el index, quita el 'data/'
    const resp = await fetch('/data/dataclean.json');
    DATA = await resp.json();
    renderKPIs();
    renderCategoryChart();
    renderFacturesTable();
  } catch (e) {
    console.error('Error carregant dades (usando datos de emergencia):', e);
    // SOLUCIÓN: Añadimos las categorías al objeto de emergencia para que no crashee
    DATA = {
      resum_indicadors: {
        I1_total_despesa_EUR: 5965.75,
        I2_total_iva_EUR: 1035.39,
        I3_despesa_per_categoria: { "Manteniment": 2000, "Neteges": 1000 } // <-- Este dato faltaba
      },
      metadata: { total_factures: 11 }
    };
    renderKPIs();
  }
}

// ---- KPI CARDS ----
function renderKPIs() {
  if (!DATA) return;
  const r = DATA.resum_indicadors;
  document.getElementById('kpi-total').textContent   = fmt(r.I1_total_despesa_EUR) + ' €';
  document.getElementById('kpi-iva').textContent      = fmt(r.I2_total_iva_EUR) + ' €';
  document.getElementById('kpi-factures').textContent = DATA.metadata?.total_factures || 11;
  document.getElementById('kpi-categories').textContent = Object.keys(r.I3_despesa_per_categoria).length;
}

function fmt(n) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ---- BAR CHART CATEGORIES ----
function renderCategoryChart() {
  if (!DATA) return;
  const cats = DATA.resum_indicadors.I3_despesa_per_categoria;
  const max = Math.max(...Object.values(cats));
  const container = document.getElementById('category-chart');
  if (!container) return;

  container.innerHTML = Object.entries(cats).map(([cat, val]) => `
    <div class="bar-row">
      <div class="bar-label">${cat}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:0" data-target="${(val/max*100).toFixed(1)}%"></div>
      </div>
      <div class="bar-val">${fmt(val)} €</div>
    </div>
  `).join('');

  // Animate after render
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(el => {
      el.style.width = el.dataset.target;
    });
  }, 300);
}

// ---- FACTURES TABLE ----
function renderFacturesTable() {
  if (!DATA || !DATA.factures) return;
  const tbody = document.getElementById('factures-tbody');
  if (!tbody) return;

  const badgeClass = { 'Material Oficina': 'badge-blue', 'Manteniment Instal-lacions': 'badge-gold',
    'Neteges i Subministraments': 'badge-green', 'Telecomunicacions': 'badge-red' };

  tbody.innerHTML = DATA.factures.map(f => `
    <tr>
      <td><strong>${f.id}</strong></td>
      <td>${f.data}</td>
      <td>${f.proveidor}</td>
      <td style="max-width:280px;font-size:0.8rem;color:var(--c-muted)">${f.descripcio_resum}</td>
      <td><span class="badge ${badgeClass[f.I3_categoria] || 'badge-green'}">${f.I3_categoria}</span></td>
      <td style="text-align:right;font-weight:600">${fmt(f.I1_import_total_EUR)} €</td>
      <td style="text-align:right;color:var(--c-muted)">${fmt(f.I2_iva_suportat_EUR)} €</td>
      <td style="font-size:0.78rem;color:var(--c-muted)">${f.I4_forma_pagament}</td>
    </tr>
  `).join('');
}

// ---- TABS ----
function initTabs() {
  document.querySelectorAll('.calc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(panel).classList.add('active');
    });
  });
}

// ---- CALCULADORA: funció principal ----
function calcProjection(type, mode, year, startMonth, endMonth) {
  const base = BASE_COSTS[type];
  const seasonal = SEASONAL[type];
  const factor = mode === 'annual' ? 1.0 : 1.0;
  const inflation = 0.03; // +3% anual estimat
  const yearAdj = Math.pow(1 + inflation, year - 2024);

  let months = [];
  let total = 0;

  if (mode === 'annual') {
    for (let i = 0; i < 12; i++) {
      const val = base * seasonal[i] * yearAdj;
      months.push({ label: MONTHS_CA[i], value: val });
      total += val;
    }
  } else {
    // Curs escolar: setembre (8) → juny (5)
    const indices = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];
    for (const i of indices) {
      const val = base * seasonal[i] * yearAdj;
      months.push({ label: MONTHS_CA[i], value: val });
      total += val;
    }
  }

  return { total, months, yearAdj, base };
}

// ---- CALCULADORA: renderitzar resultat ----
function renderCalcResult(containerId, type, mode, year) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { total, months } = calcProjection(type, mode, year);
  const modeLabel = mode === 'annual' ? `any ${year}` : `curs ${year}-${year+1}`;

  const typeLabels = {
    electric: 'Consum elèctric estimat',
    water: 'Consum d\'aigua estimat',
    office: 'Consumibles d\'oficina estimats',
    cleaning: 'Productes de neteja estimats',
  };

  container.classList.add('show');
  container.querySelector('.result-main').textContent = fmt(total) + ' €';
  container.querySelector('.result-label').textContent = `${typeLabels[type]} per al ${modeLabel}`;

  const breakdown = container.querySelector('.result-breakdown');
  if (breakdown) {
    breakdown.innerHTML = months.map(m => `
      <div class="breakdown-item">
        <div class="month">${m.label}</div>
        <div class="amount">${fmt(m.value)} €</div>
      </div>
    `).join('');
  }

  // Gràfic de barres mensual
  const chartContainer = container.querySelector('.monthly-chart');
  if (chartContainer) {
    const maxVal = Math.max(...months.map(m => m.value));
    chartContainer.innerHTML = months.map(m => `
      <div class="bar-row">
        <div class="bar-label">${m.label}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:0%; background:${getBarColor(type)}" data-target="${(m.value/maxVal*100).toFixed(1)}%"></div>
            style="background:${getBarColor(type)}"></div>
        </div>
        <div class="bar-val">${fmtShort(m.value)} €</div>
      </div>
    `).join('');

    setTimeout(() => {
      chartContainer.querySelectorAll('.bar-fill').forEach(el => {
        el.style.width = el.dataset.target;
        el.style.background = getBarColor(type);
      });
    }, 50);
  }
}

function getBarColor(type) {
  return { electric: '#e8c16a', water: '#5ca8e8', office: '#3ecf74', cleaning: '#a8e85c' }[type] || '#3ecf74';
}

// ---- ACCORDION ----
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      item.classList.toggle('open');
    });
  });
}

// ---- SCROLL ANIMATIONS ----
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ---- NAV ACTIVE STATE ----
function initNavScroll() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('nav a');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const active = document.querySelector(`nav a[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => obs.observe(s));
}

// ---- CALCULADORA HANDLERS ----
function bindCalculators() {
  // 1. Electricitat anual
  document.getElementById('btn-elec-annual')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-elec-annual-year').value);
    renderCalcResult('res-elec-annual', 'electric', 'annual', year);
  });

  // 2. Electricitat curs
  document.getElementById('btn-elec-course')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-elec-course-year').value);
    renderCalcResult('res-elec-course', 'electric', 'course', year);
  });

  // 3. Aigua anual
  document.getElementById('btn-water-annual')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-water-annual-year').value);
    renderCalcResult('res-water-annual', 'water', 'annual', year);
  });

  // 4. Aigua curs
  document.getElementById('btn-water-course')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-water-course-year').value);
    renderCalcResult('res-water-course', 'water', 'course', year);
  });

  // 5. Oficina anual
  document.getElementById('btn-office-annual')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-office-annual-year').value);
    renderCalcResult('res-office-annual', 'office', 'annual', year);
  });

  // 6. Oficina curs
  document.getElementById('btn-office-course')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-office-course-year').value);
    renderCalcResult('res-office-course', 'office', 'course', year);
  });

  // 7. Neteja anual
  document.getElementById('btn-clean-annual')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-clean-annual-year').value);
    renderCalcResult('res-clean-annual', 'cleaning', 'annual', year);
  });

  // 8. Neteja curs
  document.getElementById('btn-clean-course')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('sel-clean-course-year').value);
    renderCalcResult('res-clean-course', 'cleaning', 'course', year);
  });
}

// ---- PROGRESS BARS (reducció 30%) ----
function initProgressBars() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.progress-fill').forEach(bar => {
          bar.style.width = bar.dataset.width || '0%';
        });
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.progress-section').forEach(s => observer.observe(s));
}

// ---- CALCUL REDUCCIÓ AMB MILLORES ----
function calcWithReductions() {
  const reductions = { electric: 0.30, water: 0.25, office: 0.20, cleaning: 0.20 };
  const container = document.getElementById('reduction-results');
  if (!container) return;

  let rows = '';
  const types = [
    { key: 'electric', label: 'Consum Elèctric', icon: '⚡' },
    { key: 'water', label: 'Consum Aigua', icon: '💧' },
    { key: 'office', label: 'Consumibles Oficina', icon: '📄' },
    { key: 'cleaning', label: 'Productes Neteja', icon: '🧹' },
  ];

  let totalBefore = 0, totalAfter = 0;

  types.forEach(t => {
    const { total: before } = calcProjection(t.key, 'annual', 2025);
    const after = before * (1 - reductions[t.key]);
    const saving = before - after;
    totalBefore += before;
    totalAfter += after;

    rows += `
      <tr>
        <td>${t.icon} ${t.label}</td>
        <td style="text-align:right">${fmt(before)} €</td>
        <td style="text-align:right;color:var(--c-green)">${fmt(after)} €</td>
        <td style="text-align:right;color:var(--c-gold);font-weight:700">−${fmt(saving)} €</td>
        <td style="text-align:right"><span class="badge badge-green">−${(reductions[t.key]*100).toFixed(0)}%</span></td>
      </tr>
    `;
  });

  const totalSaving = totalBefore - totalAfter;

  container.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr>
          <th>Indicador</th><th style="text-align:right">Actual (2025)</th>
          <th style="text-align:right">Amb millores</th>
          <th style="text-align:right">Estalvi</th>
          <th style="text-align:right">Reducció</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:700;background:rgba(62,207,116,0.05)">
            <td style="color:var(--c-white);padding:1rem">TOTAL</td>
            <td style="text-align:right;padding:1rem">${fmt(totalBefore)} €</td>
            <td style="text-align:right;color:var(--c-green);padding:1rem">${fmt(totalAfter)} €</td>
            <td style="text-align:right;color:var(--c-gold);padding:1rem">−${fmt(totalSaving)} €</td>
            <td style="text-align:right;padding:1rem"><span class="badge badge-green">−${((totalSaving/totalBefore)*100).toFixed(1)}%</span></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  // Envolvemos en try catch.
  try { await loadData(); } catch(e) { console.error('Error loadData:', e); }
  try { initTabs(); } catch(e) { console.error('Error initTabs:', e); }
  try { initAccordions(); } catch(e) { console.error('Error initAccordions:', e); }
  try { initScrollAnimations(); } catch(e) { console.error('Error initScrollAnimations:', e); }
  try { initNavScroll(); } catch(e) { console.error('Error initNavScroll:', e); }
  try { bindCalculators(); } catch(e) { console.error('Error bindCalculators:', e); } // ¡Esto reactiva tu calculadora!
  try { initProgressBars(); } catch(e) { console.error('Error initProgressBars:', e); }
  try { calcWithReductions(); } catch(e) { console.error('Error calcWithReductions:', e); }

  // Animar hero stats
  setTimeout(() => {
    document.querySelectorAll('.hero-stat .val').forEach(el => {
      if(el) el.style.opacity = '1';
    });
  }, 500);
});
