/* ============================================================
   ITB LEAKS — INDICADORS DE SOSTENIBILITAT
   app.js — Lògica principal, càlculs i visualitzacions
   ============================================================ */

let DATA = null;

const SEASONAL = {
  electric: [1.30, 1.25, 1.05, 0.90, 0.85, 0.80, 0.80, 0.82, 0.95, 1.05, 1.20, 1.35],
  water:    [0.75, 0.72, 0.80, 0.90, 1.05, 1.15, 1.35, 1.30, 1.05, 0.90, 0.78, 0.75],
  office:   [1.10, 1.10, 1.05, 0.90, 1.00, 0.95, 0.50, 0.50, 1.10, 1.15, 1.10, 0.55],
  cleaning: [1.05, 1.00, 1.05, 1.00, 1.05, 1.10, 0.70, 0.70, 1.10, 1.10, 1.05, 1.10],
};

const MONTHS_CA = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];

const BASE_COSTS = {
  electric: 2548.02 / 12,
  water:    454.72  / 12,
  office:   771.29  / 12,
  cleaning: 1204.98 / 12,
};

// Factor multiplicador per escenari
// opt = millores aplicades (estalvi ~15-25%)
// pessimist = sense millores + increment extra (~10-15%)
const SCENARIO_FACTORS = {
  base:      1.00,
  opt:       0.82,   // −18%: millores energètiques / digitalització / eco
  pessimist: 1.12,   // +12%: sense cap millora + increment addicional
};

const SCENARIO_LABELS = {
  base:      'Base',
  opt:       'Optimista',
  pessimist: 'Pessimista',
};

// ---- CÀRREGA DADES ----
async function loadData() {
  try {
    const resp = await fetch('/data/dataclean.json');
    DATA = await resp.json();
    renderKPIs();
    renderCategoryChart();
    renderFacturesTable();
  } catch (e) {
    console.error('Error carregant dades (usant dades d\'emergència):', e);
    DATA = {
      resum_indicadors: {
        I1_total_despesa_EUR: 5965.75,
        I2_total_iva_EUR: 1035.39,
        I3_despesa_per_categoria: { "Manteniment": 2000, "Neteges": 1000 }
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
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('kpi-total',      fmt(r.I1_total_despesa_EUR) + ' €');
  set('kpi-iva',        fmt(r.I2_total_iva_EUR) + ' €');
  set('kpi-factures',   DATA.metadata?.total_factures || 11);
  set('kpi-categories', Object.keys(r.I3_despesa_per_categoria).length);
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
  const cats      = DATA.resum_indicadors.I3_despesa_per_categoria;
  const max       = Math.max(...Object.values(cats));
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

  const badgeClass = {
    'Material Oficina':              'badge-blue',
    'Manteniment Instal-lacions':    'badge-gold',
    'Neteges i Subministraments':    'badge-green',
    'Telecomunicacions':             'badge-red',
  };

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
  const tabs   = document.querySelectorAll('.calc-tab');
  const panels = document.querySelectorAll('.calc-panel');

  // Estat inicial net
  tabs.forEach(t => t.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  if (tabs[0])   tabs[0].classList.add('active');
  if (panels[0]) panels[0].classList.add('active');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(panelId);
      if (target) target.classList.add('active');
    });
  });
}

// ---- CALCULADORA: funció principal ----
function calcProjection(type, mode, year, scenario = 'base') {
  const base          = BASE_COSTS[type];
  const seasonal      = SEASONAL[type];
  const inflation     = 0.03;
  const yearAdj       = Math.pow(1 + inflation, year - 2024);
  const scenarioFact  = SCENARIO_FACTORS[scenario] ?? 1.0;

  const indices = mode === 'annual'
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];   // set→jun

  let months = [];
  let total  = 0;

  for (const i of indices) {
    const val = base * seasonal[i] * yearAdj * scenarioFact;
    months.push({ label: MONTHS_CA[i], value: val });
    total += val;
  }

  return { total, months, yearAdj, scenarioFact };
}

// ---- CALCULADORA: renderitzar resultat ----
function renderCalcResult(containerId, type, mode, year, scenario) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { total, months, scenarioFact } = calcProjection(type, mode, year, scenario);

  const modeLabel = mode === 'annual'
    ? `any ${year}`
    : `curs ${year}-${year + 1}`;

  const typeLabels = {
    electric: 'Consum elèctric estimat',
    water:    "Consum d'aigua estimat",
    office:   "Consumibles d'oficina estimats",
    cleaning: 'Productes de neteja estimats',
  };

  const scenarioColors = {
    base:      'var(--c-text)',
    opt:       'var(--c-green)',
    pessimist: 'var(--c-red)',
  };

  container.classList.add('show');

  container.querySelector('.result-main').textContent = fmt(total) + ' €';
  container.querySelector('.result-label').innerHTML  =
    `${typeLabels[type]} per al ${modeLabel} &nbsp;
     <span style="font-size:0.8rem;color:${scenarioColors[scenario]};font-weight:600">
       · Escenari ${SCENARIO_LABELS[scenario]}
       (×${scenarioFact.toFixed(2)})
     </span>`;

  // Desglosament mensual
  const breakdown = container.querySelector('.result-breakdown');
  if (breakdown) {
    breakdown.innerHTML = months.map(m => `
      <div class="breakdown-item">
        <div class="month">${m.label}</div>
        <div class="amount">${fmt(m.value)} €</div>
      </div>
    `).join('');
  }

// Gràfic de barres
  const chartContainer = container.querySelector('.monthly-chart');
  if (chartContainer) {
    const { months: referenceMonths } = calcProjection(type, mode, year, 'pessimist');
    const maxVal = Math.max(...referenceMonths.map(m => m.value));
    const color = getBarColor(type);

    // Comprobamos si las barras ya están dibujadas en el HTML
    const existingBars = chartContainer.querySelectorAll('.bar');

    if (existingBars.length === months.length) {
      // SI YA EXISTEN: Solo actualizamos la altura y el color.
      // Al no borrar el HTML, la transición CSS hará la animación fluida.
      months.forEach((m, index) => {
        const heightPct = ((m.value / maxVal) * 100).toFixed(1);
        existingBars[index].style.height = `${heightPct}%`;
        existingBars[index].style.background = color;
      });
    } else {
      // SI NO EXISTEN (es la primera vez que se carga): Creamos el HTML
      // y añadimos la propiedad CSS 'transition' en línea.
      chartContainer.innerHTML = months.map(m => {
        const heightPct = ((m.value / maxVal) * 100).toFixed(1);
        return `
          <div class="bar-col">
            <div class="bar" style="
              height: ${heightPct}%; 
              background: ${color}; 
              transition: height 0.5s ease-out, background 0.5s ease-out;
            "></div>
            <div class="bar-lbl">${m.label}</div>
          </div>
        `;
      }).join('');
    }
  }
}

function getBarColor(type) {
  const colors = {
    electric: 'linear-gradient(180deg,#e8c16a,rgba(232,193,106,0.25))',
    water:    'linear-gradient(180deg,#5ca8e8,rgba(92,168,232,0.25))',
    office:   'linear-gradient(180deg,#3ecf74,rgba(62,207,116,0.25))',
    cleaning: 'linear-gradient(180deg,#a8e85c,rgba(168,232,92,0.25))',
  };
  return colors[type] || colors.office;
}

// ---- ACCORDION ----
function initAccordions() {
  // 1. Buscamos todas las cabeceras en las que se puede hacer clic
  const headers = document.querySelectorAll('.accordion-header');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      // 2. Localizamos la "tarjeta" entera a la que pertenece esta cabecera
      const currentItem = header.closest('.accordion-item');

      // Opcional: Si quieres que al abrir uno se cierren los demás automáticamente,
      // descomenta las siguientes 3 líneas:
      // document.querySelectorAll('.accordion-item').forEach(item => {
      //   if (item !== currentItem) item.classList.remove('active');
      // });

      // 3. Añadimos o quitamos la clase 'active' para que el CSS haga la magia
      currentItem.classList.toggle('active');
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
// Cada binding: [btnId, yearSelId, scenarioSelId, resultId, type, mode]
function bindCalculators() {
  const bindings = [
    ['btn-elec-annual',  'sel-elec-annual-year',  'sel-elec-annual-scenario',  'res-elec-annual',  'electric', 'annual'],
    ['btn-elec-course',  'sel-elec-course-year',  'sel-elec-course-scenario',  'res-elec-course',  'electric', 'course'],
    ['btn-water-annual', 'sel-water-annual-year', 'sel-water-annual-scenario', 'res-water-annual', 'water',    'annual'],
    ['btn-water-course', 'sel-water-course-year', 'sel-water-course-scenario', 'res-water-course', 'water',    'course'],
    ['btn-office-annual','sel-office-annual-year','sel-office-annual-scenario','res-office-annual','office',   'annual'],
    ['btn-office-course','sel-office-course-year','sel-office-course-scenario','res-office-course','office',   'course'],
    ['btn-clean-annual', 'sel-clean-annual-year', 'sel-clean-annual-scenario', 'res-clean-annual', 'cleaning', 'annual'],
    ['btn-clean-course', 'sel-clean-course-year', 'sel-clean-course-scenario', 'res-clean-course', 'cleaning', 'course'],
  ];

  bindings.forEach(([btnId, yearSelId, scenarioSelId, resId, type, mode]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const year     = parseInt(document.getElementById(yearSelId)?.value || '2025');
      const scenario = document.getElementById(scenarioSelId)?.value || 'base';
      renderCalcResult(resId, type, mode, year, scenario);
    });
  });
}

// ---- PROGRESS BARS ----
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
  const container  = document.getElementById('reduction-results');
  if (!container) return;

  const types = [
    { key: 'electric', label: 'Consum Elèctric',    icon: '⚡' },
    { key: 'water',    label: 'Consum Aigua',        icon: '💧' },
    { key: 'office',   label: 'Consumibles Oficina', icon: '📄' },
    { key: 'cleaning', label: 'Productes Neteja',    icon: '🧹' },
  ];

  let totalBefore = 0, totalAfter = 0;

  const rows = types.map(t => {
    const { total: before } = calcProjection(t.key, 'annual', 2025, 'base');
    const after  = before * (1 - reductions[t.key]);
    const saving = before - after;
    totalBefore += before;
    totalAfter  += after;
    return `
      <tr>
        <td>${t.icon} ${t.label}</td>
        <td style="text-align:right">${fmt(before)} €</td>
        <td style="text-align:right;color:var(--c-green)">${fmt(after)} €</td>
        <td style="text-align:right;color:var(--c-gold);font-weight:700">−${fmt(saving)} €</td>
        <td style="text-align:right"><span class="badge badge-green">−${(reductions[t.key]*100).toFixed(0)}%</span></td>
      </tr>
    `;
  }).join('');

  const totalSaving = totalBefore - totalAfter;
  container.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr>
          <th>Indicador</th>
          <th style="text-align:right">Actual (2025)</th>
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
            <td style="text-align:right;padding:1rem">
              <span class="badge badge-green">−${((totalSaving/totalBefore)*100).toFixed(1)}%</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  try { await loadData();       } catch(e) { console.error('loadData:', e); }
  try { initTabs();             } catch(e) { console.error('initTabs:', e); }
  try { initAccordions();       } catch(e) { console.error('initAccordions:', e); }
  try { initScrollAnimations(); } catch(e) { console.error('initScrollAnimations:', e); }
  try { initNavScroll();        } catch(e) { console.error('initNavScroll:', e); }
  try { bindCalculators();      } catch(e) { console.error('bindCalculators:', e); }
  try { initProgressBars();     } catch(e) { console.error('initProgressBars:', e); }
  try { calcWithReductions();   } catch(e) { console.error('calcWithReductions:', e); }

  setTimeout(() => {
    document.querySelectorAll('.hero-stat .val').forEach(el => {
      if (el) el.style.opacity = '1';
    });
  }, 500);

  // Menú hamburguesa
  const menuBtn  = document.querySelector('.nav-mobile-btn');
  const navLinks = document.querySelector('.nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => navLinks.classList.toggle('show'));
  }
});