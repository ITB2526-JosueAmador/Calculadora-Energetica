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
// base = tendència actual sense canvis
// opt_X = escenaris optimistes amb millores específiques
// pessimist_X = escenaris pessimistes amb degradació específica
const SCENARIO_FACTORS = {
  base:           1.00,
  all_opt:        0.72,  // millor cas global: totes les millores aplicades
  all_pes:        1.22,  // pitjor cas global: totes les degradacions combinades

  // ─── ELECTRICITAT ───────────────────────────────────────────────
  elec_opt_solar:   0.68,   // −32%: instal·lació de panells fotovoltaics al terrat
  elec_opt_led:     0.80,   // −20%: substitució total per LEDs i sensors de presència
  elec_opt_smart:   0.85,   // −15%: gestió intel·ligent de consum i programació horària
  elec_opt_cert:    0.90,   // −10%: certificació energètica A+ i auditoria de consums

  elec_pes_avaria:  1.20,   // +20%: avaria de compressors amb sistemes ineficients de substitució
  elec_pes_vell:    1.12,   // +12%: envelliment de la instal·lació sense manteniment preventiu
  elec_pes_tarifa:  1.08,   // +8%: increment de la tarifa elèctrica per sobre de la inflació prevista
  elec_pes_perd:    1.15,   // +15%: pèrdua del contracte tarifari avantatjós actual

  // ─── AIGUA ──────────────────────────────────────────────────────
  water_opt_grises:  0.70,  // −30%: sistema de recuperació i reutilització d'aigües grises
  water_opt_sensors: 0.82,  // −18%: sensors de fuites i tancament automàtic de circuits
  water_opt_reg:     0.88,  // −12%: reg per degoteig intel·ligent amb sonda d'humitat
  water_opt_cistern: 0.93,  // −7%: cisternes de doble descàrrega i airejadors en aixetes

  water_pes_sequera: 1.18,  // +18%: sequera + restriccions que disparen el cost per m³
  water_pes_canon:   1.10,  // +10%: increment del cànon de l'aigua per la Generalitat
  water_pes_fuites:  1.22,  // +22%: canonades deteriorades amb fuites no detectades
  water_pes_ocup:    1.14,  // +14%: augment significatiu de l'ocupació del centre sense millores

  // ─── OFICINA ────────────────────────────────────────────────────
  office_opt_digi:   0.72,  // −28%: digitalització total d'expedients i gestió documental
  office_opt_dcara:  0.83,  // −17%: impressió a doble cara obligatòria i paperless per defecte
  office_opt_reuti:  0.88,  // −12%: programa de reutilització i compra de material reciclat
  office_opt_audt:   0.93,  // −7%: auditoria de consums i control d'estoc centralitzat

  office_pes_creix:  1.15,  // +15%: creixement de matrícula sense adaptació digital dels processos
  office_pes_impr:   1.08,  // +8%: deteriorament d'impressores amb consum excessiu de tòner
  office_pes_urgn:   1.12,  // +12%: compres urgents a proveïdors sense acord marc (+cost unitari)
  office_pes_cost:   1.09,  // +9%: increment general del cost de paper i material d'oficina

  // ─── NETEJA ─────────────────────────────────────────────────────
  clean_opt_ecol:    0.78,  // −22%: productes ecològics concentrats amb menor dosi per ús
  clean_opt_maqui:   0.84,  // −16%: maquinària d'alta eficiència (fregadores automàtiques)
  clean_opt_freq:    0.90,  // −10%: reducció de freqüència amb millor efectivitat per producte
  clean_opt_audt:    0.94,  // −6%: auditoria de processos de neteja i optimització de circuits

  clean_pes_norm:    1.16,  // +16%: nova normativa sanitària amb protocols de desinfecció addicionals
  clean_pes_desin:   1.10,  // +10%: necessitat de productes virucides i bactericides d'alt cost
  clean_pes_superf:  1.13,  // +13%: ampliació de la superfície neta sense increment de pressupost
  clean_pes_rotat:   1.08,  // +8%: alta rotació de personal que incrementa el consum per falta de formació
};

// Metadades dels escenaris: etiqueta, tipus, factor i descripció
const SCENARIO_META = {
  base: { label: 'Base (tendència actual)', group: 'base', factor: 1.00,
    desc: 'Projecció sense canvis significatius, seguint la tendència actual de consums.' },

  all_opt: { label: '🌟 Tot optimista (totes les millores)', group: 'opt', factor: 0.72,
    desc: "Escenari global on s'apliquen totes les millores possibles simultàniament: energètiques, hídrica, digitalització i neteja ecològica. Màxim estalvi assolible." },
  all_pes: { label: '💀 Tot pessimista (pitjor cas possible)', group: 'pessimist', factor: 1.22,
    desc: "Escenari global que combina totes les degradacions alhora: avaries, encariment de subministraments, normatives restrictives i creixement no gestionat. Màxim cost possible." },

  elec_opt_solar:  { label: '☀️ Panells fotovoltaics',        group: 'opt', factor: 0.68, desc: 'Instal·lació de panells solars al terrat del centre. Estalvi estimat del 32% en la factura elèctrica anual.' },
  elec_opt_led:    { label: '💡 LED + sensors de presència',  group: 'opt', factor: 0.80, desc: 'Substitució de tota la il·luminació per tecnologia LED i instal·lació de sensors de presència a aules i passadissos.' },
  elec_opt_smart:  { label: '🔌 Gestió intel·ligent',         group: 'opt', factor: 0.85, desc: 'Sistema de gestió energètica intel·ligent amb programació horària i monitoratge en temps real del consum.' },
  elec_opt_cert:   { label: '🏷️ Certificació energètica A+',  group: 'opt', factor: 0.90, desc: 'Auditoria energètica completa i obtenció de la certificació A+, amb mesures de millora en aïllament i climatització.' },

  elec_pes_avaria: { label: '⚠️ Avaria de compressors',       group: 'pessimist', factor: 1.20, desc: 'Avaria dels sistemes de climatització principals amb ús de equips de substitució molt menys eficients.' },
  elec_pes_vell:   { label: '🔧 Instal·lació deteriorada',    group: 'pessimist', factor: 1.12, desc: 'Envelliment progressiu de la instal·lació sense manteniment preventiu, amb pèrdues per resistència i sobrecàlrregues.' },
  elec_pes_tarifa: { label: '📈 Increment de tarifa',         group: 'pessimist', factor: 1.08, desc: 'Pujada de la tarifa elèctrica per sobre de la inflació prevista, sense possibilitat de negociar millors condicions.' },
  elec_pes_perd:   { label: '📉 Pèrdua de contracte TUR',     group: 'pessimist', factor: 1.15, desc: "Pèrdua del contracte tarifari avantatjós actual i necessitat d'accedir al mercat lliure a un preu superior." },

  water_opt_grises:  { label: '♻️ Recuperació aigües grises',  group: 'opt', factor: 0.70, desc: 'Sistema de recollida i reutilització de les aigües grises dels lavabos per al reg i cisternes dels vàters.' },
  water_opt_sensors: { label: '🔍 Sensors de fuites',          group: 'opt', factor: 0.82, desc: 'Xarxa de sensors intel·ligents per a la detecció precoç de fuites i el tancament automàtic de circuits.' },
  water_opt_reg:     { label: '🌱 Reg per degoteig',           group: 'opt', factor: 0.88, desc: 'Substitució del reg per aspersió per sistemes de degoteig amb sonda de humitat i programació meteorològica.' },
  water_opt_cistern: { label: '🚿 Cisternes i airejadors',     group: 'opt', factor: 0.93, desc: 'Instal·lació de cisternes de doble descàrrega (3/6 L) i airejadors a totes les aixetes i dutxes del centre.' },

  water_pes_sequera: { label: '🏜️ Sequera + restriccions',    group: 'pessimist', factor: 1.18, desc: 'Episodi de sequera severa amb restriccions oficials que disparen el preu del m³ i obliguen a mesures de proveïment alternatiu.' },
  water_pes_canon:   { label: '💸 Increment del cànon',        group: 'pessimist', factor: 1.10, desc: "Increment del cànon de l'aigua i les taxes de sanejament per sobre del previst en els pressupostos del centre." },
  water_pes_fuites:  { label: '🔩 Fuites en canonades',        group: 'pessimist', factor: 1.22, desc: 'Fuites no detectades en canonades antigues que incrementen el consum real molt per sobre del registrat als comptadors.' },
  water_pes_ocup:    { label: '👥 Creixement d\'ocupació',     group: 'pessimist', factor: 1.14, desc: "Augment significatiu de l'alumnat i personal sense adaptar les instal·lacions hidràuliques a la nova demanda." },

  office_opt_digi:   { label: '📱 Digitalització total',        group: 'opt', factor: 0.72, desc: 'Migració completa de tots els expedients i processos administratius a plataformes digitals, eliminant el paper en un 90%.' },
  office_opt_dcara:  { label: '📋 Impressió doble cara',        group: 'opt', factor: 0.83, desc: "Política d'impressió a doble cara com a opció per defecte i cultura paperless amb validació de documents en pantalla." },
  office_opt_reuti:  { label: '♻️ Material reciclat',           group: 'opt', factor: 0.88, desc: "Programa de reutilització de material d'oficina i preferència per la compra de productes amb contingut reciclat certificat." },
  office_opt_audt:   { label: '📊 Auditoria i control',         group: 'opt', factor: 0.93, desc: "Auditoria de consums, control d'estoc centralitzat i licitació conjunta amb altres centres per reduir el cost unitari." },

  office_pes_creix:  { label: '📚 Creixement sense digitalitzar', group: 'pessimist', factor: 1.15, desc: "Increment de l'alumnat i de la burocràcia administrativa sense aprofitar les eines digitals disponibles." },
  office_pes_impr:   { label: '🖨️ Avaries d\'impressores',    group: 'pessimist', factor: 1.08, desc: "Deteriorament de les impressores amb consum excessiu de tòner, paper d'altes gramatures i freqüents atascos." },
  office_pes_urgn:   { label: '🚨 Compres urgents fora d\'acord', group: 'pessimist', factor: 1.12, desc: "Trencament de l'estoc que obliga a compres urgents a proveïdors no homologats a preus molt superiors al contracte marc." },
  office_pes_cost:   { label: '💰 Increment cost de paper',    group: 'pessimist', factor: 1.09, desc: 'Increment general del cost de les matèries primeres (cel·lulosa, plàstics) que encareix el material d\'oficina.' },

  clean_opt_ecol:    { label: '🌿 Productes ecològics concentrats', group: 'opt', factor: 0.78, desc: 'Substitució per productes ecològics d\'alta concentració que requereixen menor quantitat per ús i redueixen l\'impacte ambiental.' },
  clean_opt_maqui:   { label: '🤖 Maquinària d\'alta eficiència',  group: 'opt', factor: 0.84, desc: 'Inversió en fregadores automàtiques i aspiradores industrials eficients que redueixen el consum de productes i el temps de neteja.' },
  clean_opt_freq:    { label: '📅 Optimització de freqüència',     group: 'opt', factor: 0.90, desc: "Revisió dels circuits de neteja per optimitzar la freqüència d'intervenció sense perdre la qualitat higiènica del centre." },
  clean_opt_audt:    { label: '🔬 Auditoria de processos',         group: 'opt', factor: 0.94, desc: 'Auditoria completa dels processos de neteja per identificar duplicitats, ineficiències i zones de millora en el pla de treball.' },

  clean_pes_norm:    { label: '📜 Nova normativa sanitària',       group: 'pessimist', factor: 1.16, desc: 'Aprovació de nova normativa sanitària que exigeix protocols de desinfecció més freqüents amb productes homologats específics.' },
  clean_pes_desin:   { label: '🧪 Productes virucides obligatoris', group: 'pessimist', factor: 1.10, desc: "Obligació d'incorporar productes virucides i bactericides d'alt cost als protocols habituals de neteja." },
  clean_pes_superf:  { label: '🏗️ Ampliació de superfície',       group: 'pessimist', factor: 1.13, desc: "Incorporació de noves aules o espais al centre sense increment proporcional del pressupost de neteja." },
  clean_pes_rotat:   { label: '👷 Alta rotació de personal',       group: 'pessimist', factor: 1.08, desc: "Alta rotació del personal de neteja que incrementa el consum per la manca de formació en els protocols d'estalvi del centre." },
};

const SCENARIO_LABELS = {
  base:      'Base',
};
// Afegim etiquetes dinàmicament
Object.entries(SCENARIO_META).forEach(([k, v]) => {
  SCENARIO_LABELS[k] = v.label;
});

// Mapa: per a cada selector de cada panell, quins escenaris mostrar
const SCENARIO_GROUPS = {
  electric: ['elec_opt_solar','elec_opt_led','elec_opt_smart','elec_opt_cert',
             'elec_pes_avaria','elec_pes_vell','elec_pes_tarifa','elec_pes_perd'],
  water:    ['water_opt_grises','water_opt_sensors','water_opt_reg','water_opt_cistern',
             'water_pes_sequera','water_pes_canon','water_pes_fuites','water_pes_ocup'],
  office:   ['office_opt_digi','office_opt_dcara','office_opt_reuti','office_opt_audt',
             'office_pes_creix','office_pes_impr','office_pes_urgn','office_pes_cost'],
  cleaning: ['clean_opt_ecol','clean_opt_maqui','clean_opt_freq','clean_opt_audt',
             'clean_pes_norm','clean_pes_desin','clean_pes_superf','clean_pes_rotat'],
};

// ---- CÀRREGA DADES ----
async function loadData() {
  try {
    const resp = await fetch('../data/dataclean.json');
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
  const scenarioFact  = SCENARIO_FACTORS[scenario] ?? SCENARIO_META[scenario]?.factor ?? 1.0;

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

  const scenarioMeta = SCENARIO_META[scenario] || { label: 'Base', group: 'base', desc: 'Projecció sense canvis.', factor: 1.0 };
  const scenarioGroup = scenarioMeta.group;

  const scenarioColors = {
    base:      'var(--c-text)',
    opt:       'var(--c-green)',
    pessimist: 'var(--c-red)',
  };
  const scColor = scenarioColors[scenarioGroup] || 'var(--c-text)';

  container.classList.add('show');

  container.querySelector('.result-main').textContent = fmt(total) + ' €';
  container.querySelector('.result-label').innerHTML  =
    `${typeLabels[type]} per al ${modeLabel} &nbsp;
     <span style="font-size:0.8rem;color:${scColor};font-weight:600">
       · ${scenarioMeta.label}
       (×${scenarioFact.toFixed(2)})
     </span>
     <div style="margin-top:0.5rem;font-size:0.78rem;color:var(--c-muted);font-style:italic">${scenarioMeta.desc}</div>`;

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

// ---- OMPLIR SELECTORS D'ESCENARI ────────────────────────────────────────────
// Definim quins escenaris corresponen a cada tipus de recurs
const SELECTOR_TYPE_MAP = {
  'sel-elec-annual-scenario':  'electric',
  'sel-elec-course-scenario':  'electric',
  'sel-water-annual-scenario': 'water',
  'sel-water-course-scenario': 'water',
  'sel-office-annual-scenario':'office',
  'sel-office-course-scenario':'office',
  'sel-clean-annual-scenario': 'cleaning',
  'sel-clean-course-scenario': 'cleaning',
};

function populateScenarioSelects() {
  Object.entries(SELECTOR_TYPE_MAP).forEach(([selId, resourceType]) => {
    const sel = document.getElementById(selId);
    if (!sel) return;

    const keys = SCENARIO_GROUPS[resourceType];
    const optKeys = keys.filter(k => SCENARIO_META[k].group === 'opt');
    const pesKeys = keys.filter(k => SCENARIO_META[k].group === 'pessimist');

    sel.innerHTML = `<option value="base">${SCENARIO_META.base.label}</option>`;

    // Opcions globals
    const grpGlobal = document.createElement('optgroup');
    grpGlobal.label = '⚡ Escenaris globals';
    ['all_opt', 'all_pes'].forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = SCENARIO_META[k].label;
      grpGlobal.appendChild(o);
    });
    sel.appendChild(grpGlobal);

    const grpOpt = document.createElement('optgroup');
    grpOpt.label = '🟢 Optimista';
    optKeys.forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = SCENARIO_META[k].label;
      grpOpt.appendChild(o);
    });
    sel.appendChild(grpOpt);

    const grpPes = document.createElement('optgroup');
    grpPes.label = '🔴 Pessimista';
    pesKeys.forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = SCENARIO_META[k].label;
      grpPes.appendChild(o);
    });
    sel.appendChild(grpPes);
  });
}

// ---- CALCULADORA HANDLERS ----
// Cada binding: [yearInputId, scenarioSelId, resultId, type, mode]
function bindCalculators() {
  const currentYear = new Date().getFullYear();

  const bindings = [
    ['inp-elec-annual-year',  'sel-elec-annual-scenario',  'res-elec-annual',  'electric', 'annual'],
    ['inp-elec-course-year',  'sel-elec-course-scenario',  'res-elec-course',  'electric', 'course'],
    ['inp-water-annual-year', 'sel-water-annual-scenario', 'res-water-annual', 'water',    'annual'],
    ['inp-water-course-year', 'sel-water-course-scenario', 'res-water-course', 'water',    'course'],
    ['inp-office-annual-year','sel-office-annual-scenario','res-office-annual','office',   'annual'],
    ['inp-office-course-year','sel-office-course-scenario','res-office-course','office',   'course'],
    ['inp-clean-annual-year', 'sel-clean-annual-scenario', 'res-clean-annual', 'cleaning', 'annual'],
    ['inp-clean-course-year', 'sel-clean-course-scenario', 'res-clean-course', 'cleaning', 'course'],
  ];

  bindings.forEach(([yearInpId, scenarioSelId, resId, type, mode]) => {
    const yearInp     = document.getElementById(yearInpId);
    const scenarioSel = document.getElementById(scenarioSelId);
    if (!yearInp || !scenarioSel) return;

    // Valor per defecte: any vinent
    yearInp.value = currentYear + 1;
    yearInp.min   = currentYear;
    yearInp.max   = currentYear + 50;

    const doCalc = () => {
      let year = parseInt(yearInp.value);
      if (isNaN(year) || year < currentYear) { year = currentYear; yearInp.value = year; }
      if (year > currentYear + 50)           { year = currentYear + 50; yearInp.value = year; }
      const scenario = scenarioSel.value || 'base';
      renderCalcResult(resId, type, mode, year, scenario);
    };

    yearInp.addEventListener('input', doCalc);
    yearInp.addEventListener('change', doCalc);
    scenarioSel.addEventListener('change', doCalc);

    // Càlcul inicial automàtic
    doCalc();
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
  try { populateScenarioSelects(); } catch(e) { console.error('populateScenarioSelects:', e); }
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