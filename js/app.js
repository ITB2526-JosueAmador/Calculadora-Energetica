/* ============================================================
   ITB LEAKS — INDICADORS DE SOSTENIBILITAT
   app.js — Lògica principal, càlculs i visualitzacions
   ============================================================ */

let DATA = null;

const SEASONAL = {
  electric: [1.30, 1.25, 1.05, 0.90, 0.85, 0.80, 0.80, 0.82, 0.95, 1.05, 1.20, 1.35],
  water: [0.75, 0.72, 0.80, 0.90, 1.05, 1.15, 1.35, 1.30, 1.05, 0.90, 0.78, 0.75],
  office: [1.10, 1.10, 1.05, 0.90, 1.00, 0.95, 0.50, 0.50, 1.10, 1.15, 1.10, 0.55],
  cleaning: [1.05, 1.00, 1.05, 1.00, 1.05, 1.10, 0.70, 0.70, 1.10, 1.10, 1.05, 1.10],
};

const MONTHS_CA = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];

const BASE_COSTS = {
  electric: 2548.02 / 12,
  water: 454.72 / 12,
  office: 771.29 / 12,
  cleaning: 1204.98 / 12,
};

// Factor multiplicador per escenari
// base = tendència actual sense canvis
// opt_X = escenaris optimistes amb millores específiques
// pessimist_X = escenaris pessimistes amb degradació específica
const SCENARIO_FACTORS = {
  base: 1.00,
  all_opt: 0.72,  // millor cas global: totes les millores aplicades
  all_pes: 1.22,  // pitjor cas global: totes les degradacions combinades

  // ─── ELECTRICITAT ───────────────────────────────────────────────
  elec_opt_solar: 0.68,   // −32%: instal·lació de panells fotovoltaics al terrat
  elec_opt_led: 0.80,   // −20%: substitució total per LEDs i sensors de presència
  elec_opt_smart: 0.85,   // −15%: gestió intel·ligent de consum i programació horària
  elec_opt_cert: 0.90,   // −10%: certificació energètica A+ i auditoria de consums

  elec_pes_avaria: 1.20,   // +20%: avaria de compressors amb sistemes ineficients de substitució
  elec_pes_vell: 1.12,   // +12%: envelliment de la instal·lació sense manteniment preventiu
  elec_pes_tarifa: 1.08,   // +8%: increment de la tarifa elèctrica per sobre de la inflació prevista
  elec_pes_perd: 1.15,   // +15%: pèrdua del contracte tarifari avantatjós actual

  // ─── AIGUA ──────────────────────────────────────────────────────
  water_opt_grises: 0.70,  // −30%: sistema de recuperació i reutilització d'aigües grises
  water_opt_sensors: 0.82,  // −18%: sensors de fuites i tancament automàtic de circuits
  water_opt_reg: 0.88,  // −12%: reg per degoteig intel·ligent amb sonda d'humitat
  water_opt_cistern: 0.93,  // −7%: cisternes de doble descàrrega i airejadors en aixetes

  water_pes_sequera: 1.18,  // +18%: sequera + restriccions que disparen el cost per m³
  water_pes_canon: 1.10,  // +10%: increment del cànon de l'aigua per la Generalitat
  water_pes_fuites: 1.22,  // +22%: canonades deteriorades amb fuites no detectades
  water_pes_ocup: 1.14,  // +14%: augment significatiu de l'ocupació del centre sense millores

  // ─── OFICINA ────────────────────────────────────────────────────
  office_opt_digi: 0.72,  // −28%: digitalització total d'expedients i gestió documental
  office_opt_dcara: 0.83,  // −17%: impressió a doble cara obligatòria i paperless per defecte
  office_opt_reuti: 0.88,  // −12%: programa de reutilització i compra de material reciclat
  office_opt_audt: 0.93,  // −7%: auditoria de consums i control d'estoc centralitzat

  office_pes_creix: 1.15,  // +15%: creixement de matrícula sense adaptació digital dels processos
  office_pes_impr: 1.08,  // +8%: deteriorament d'impressores amb consum excessiu de tòner
  office_pes_urgn: 1.12,  // +12%: compres urgents a proveïdors sense acord marc (+cost unitari)
  office_pes_cost: 1.09,  // +9%: increment general del cost de paper i material d'oficina

  // ─── NETEJA ─────────────────────────────────────────────────────
  clean_opt_ecol: 0.78,  // −22%: productes ecològics concentrats amb menor dosi per ús
  clean_opt_maqui: 0.84,  // −16%: maquinària d'alta eficiència (fregadores automàtiques)
  clean_opt_freq: 0.90,  // −10%: reducció de freqüència amb millor efectivitat per producte
  clean_opt_audt: 0.94,  // −6%: auditoria de processos de neteja i optimització de circuits

  clean_pes_norm: 1.16,  // +16%: nova normativa sanitària amb protocols de desinfecció addicionals
  clean_pes_desin: 1.10,  // +10%: necessitat de productes virucides i bactericides d'alt cost
  clean_pes_superf: 1.13,  // +13%: ampliació de la superfície neta sense increment de pressupost
  clean_pes_rotat: 1.08,  // +8%: alta rotació de personal que incrementa el consum per falta de formació
};

// Metadades dels escenaris: etiqueta, tipus, factor i descripció
const SCENARIO_META = {
  base: {
    label: 'Base (tendència actual)', group: 'base', factor: 1.00,
    desc: 'Projecció sense canvis significatius, seguint la tendència actual de consums.'
  },

  simulador: {
    label: '🎛️ Des del Simulador', group: 'base', factor: 1.00,
    desc: 'Utilitza les accions de reducció actualment activades al Simulador.'
  },

  all_opt: {
    label: '🌟 Tot optimista (totes les millores)', group: 'opt', factor: 0.72,
    desc: "Escenari global on s'apliquen totes les millores possibles simultàniament: energètiques, hídrica, digitalització i neteja ecològica. Màxim estalvi assolible."
  },
  all_pes: {
    label: '💀 Tot pessimista (pitjor cas possible)', group: 'pessimist', factor: 1.22,
    desc: "Escenari global que combina totes les degradacions alhora: avaries, encariment de subministraments, normatives restrictives i creixement no gestionat. Màxim cost possible."
  },

  elec_opt_solar: { label: '☀️ Panells fotovoltaics', group: 'opt', factor: 0.68, desc: 'Instal·lació de panells solars al terrat del centre. Estalvi estimat del 32% en la factura elèctrica anual.' },
  elec_opt_led: { label: '💡 LED + sensors de presència', group: 'opt', factor: 0.80, desc: 'Substitució de tota la il·luminació per tecnologia LED i instal·lació de sensors de presència a aules i passadissos.' },
  elec_opt_smart: { label: '🔌 Gestió intel·ligent', group: 'opt', factor: 0.85, desc: 'Sistema de gestió energètica intel·ligent amb programació horària i monitoratge en temps real del consum.' },
  elec_opt_cert: { label: '🏷️ Certificació energètica A+', group: 'opt', factor: 0.90, desc: 'Auditoria energètica completa i obtenció de la certificació A+, amb mesures de millora en aïllament i climatització.' },

  elec_pes_avaria: { label: '⚠️ Avaria de compressors', group: 'pessimist', factor: 1.20, desc: 'Avaria dels sistemes de climatització principals amb ús de equips de substitució molt menys eficients.' },
  elec_pes_vell: { label: '🔧 Instal·lació deteriorada', group: 'pessimist', factor: 1.12, desc: 'Envelliment progressiu de la instal·lació sense manteniment preventiu, amb pèrdues per resistència i sobrecàlrregues.' },
  elec_pes_tarifa: { label: '📈 Increment de tarifa', group: 'pessimist', factor: 1.08, desc: 'Pujada de la tarifa elèctrica per sobre de la inflació prevista, sense possibilitat de negociar millors condicions.' },
  elec_pes_perd: { label: '📉 Pèrdua de contracte TUR', group: 'pessimist', factor: 1.15, desc: "Pèrdua del contracte tarifari avantatjós actual i necessitat d'accedir al mercat lliure a un preu superior." },

  water_opt_grises: { label: '♻️ Recuperació aigües grises', group: 'opt', factor: 0.70, desc: 'Sistema de recollida i reutilització de les aigües grises dels lavabos per al reg i cisternes dels vàters.' },
  water_opt_sensors: { label: '🔍 Sensors de fuites', group: 'opt', factor: 0.82, desc: 'Xarxa de sensors intel·ligents per a la detecció precoç de fuites i el tancament automàtic de circuits.' },
  water_opt_reg: { label: '🌱 Reg per degoteig', group: 'opt', factor: 0.88, desc: 'Substitució del reg per aspersió per sistemes de degoteig amb sonda de humitat i programació meteorològica.' },
  water_opt_cistern: { label: '🚿 Cisternes i airejadors', group: 'opt', factor: 0.93, desc: 'Instal·lació de cisternes de doble descàrrega (3/6 L) i airejadors a totes les aixetes i dutxes del centre.' },

  water_pes_sequera: { label: '🏜️ Sequera + restriccions', group: 'pessimist', factor: 1.18, desc: 'Episodi de sequera severa amb restriccions oficials que disparen el preu del m³ i obliguen a mesures de proveïment alternatiu.' },
  water_pes_canon: { label: '💸 Increment del cànon', group: 'pessimist', factor: 1.10, desc: "Increment del cànon de l'aigua i les taxes de sanejament per sobre del previst en els pressupostos del centre." },
  water_pes_fuites: { label: '🔩 Fuites en canonades', group: 'pessimist', factor: 1.22, desc: 'Fuites no detectades en canonades antigues que incrementen el consum real molt per sobre del registrat als comptadors.' },
  water_pes_ocup: { label: '👥 Creixement d\'ocupació', group: 'pessimist', factor: 1.14, desc: "Augment significatiu de l'alumnat i personal sense adaptar les instal·lacions hidràuliques a la nova demanda." },

  office_opt_digi: { label: '📱 Digitalització total', group: 'opt', factor: 0.72, desc: 'Migració completa de tots els expedients i processos administratius a plataformes digitals, eliminant el paper en un 90%.' },
  office_opt_dcara: { label: '📋 Impressió doble cara', group: 'opt', factor: 0.83, desc: "Política d'impressió a doble cara com a opció per defecte i cultura paperless amb validació de documents en pantalla." },
  office_opt_reuti: { label: '♻️ Material reciclat', group: 'opt', factor: 0.88, desc: "Programa de reutilització de material d'oficina i preferència per la compra de productes amb contingut reciclat certificat." },
  office_opt_audt: { label: '📊 Auditoria i control', group: 'opt', factor: 0.93, desc: "Auditoria de consums, control d'estoc centralitzat i licitació conjunta amb altres centres per reduir el cost unitari." },

  office_pes_creix: { label: '📚 Creixement sense digitalitzar', group: 'pessimist', factor: 1.15, desc: "Increment de l'alumnat i de la burocràcia administrativa sense aprofitar les eines digitals disponibles." },
  office_pes_impr: { label: '🖨️ Avaries d\'impressores', group: 'pessimist', factor: 1.08, desc: "Deteriorament de les impressores amb consum excessiu de tòner, paper d'altes gramatures i freqüents atascos." },
  office_pes_urgn: { label: '🚨 Compres urgents fora d\'acord', group: 'pessimist', factor: 1.12, desc: "Trencament de l'estoc que obliga a compres urgents a proveïdors no homologats a preus molt superiors al contracte marc." },
  office_pes_cost: { label: '💰 Increment cost de paper', group: 'pessimist', factor: 1.09, desc: 'Increment general del cost de les matèries primeres (cel·lulosa, plàstics) que encareix el material d\'oficina.' },

  clean_opt_ecol: { label: '🌿 Productes ecològics concentrats', group: 'opt', factor: 0.78, desc: 'Substitució per productes ecològics d\'alta concentració que requereixen menor quantitat per ús i redueixen l\'impacte ambiental.' },
  clean_opt_maqui: { label: '🤖 Maquinària d\'alta eficiència', group: 'opt', factor: 0.84, desc: 'Inversió en fregadores automàtiques i aspiradores industrials eficients que redueixen el consum de productes i el temps de neteja.' },
  clean_opt_freq: { label: '📅 Optimització de freqüència', group: 'opt', factor: 0.90, desc: "Revisió dels circuits de neteja per optimitzar la freqüència d'intervenció sense perdre la qualitat higiènica del centre." },
  clean_opt_audt: { label: '🔬 Auditoria de processos', group: 'opt', factor: 0.94, desc: 'Auditoria completa dels processos de neteja per identificar duplicitats, ineficiències i zones de millora en el pla de treball.' },

  clean_pes_norm: { label: '📜 Nova normativa sanitària', group: 'pessimist', factor: 1.16, desc: 'Aprovació de nova normativa sanitària que exigeix protocols de desinfecció més freqüents amb productes homologats específics.' },
  clean_pes_desin: { label: '🧪 Productes virucides obligatoris', group: 'pessimist', factor: 1.10, desc: "Obligació d'incorporar productes virucides i bactericides d'alt cost als protocols habituals de neteja." },
  clean_pes_superf: { label: '🏗️ Ampliació de superfície', group: 'pessimist', factor: 1.13, desc: "Incorporació de noves aules o espais al centre sense increment proporcional del pressupost de neteja." },
  clean_pes_rotat: { label: '👷 Alta rotació de personal', group: 'pessimist', factor: 1.08, desc: "Alta rotació del personal de neteja que incrementa el consum per la manca de formació en els protocols d'estalvi del centre." },
};

const SCENARIO_LABELS = {
  base: 'Base',
};
// Afegim etiquetes dinàmicament
Object.entries(SCENARIO_META).forEach(([k, v]) => {
  SCENARIO_LABELS[k] = v.label;
});

// Mapa: per a cada selector de cada panell, quins escenaris mostrar
const SCENARIO_GROUPS = {
  electric: ['elec_opt_solar', 'elec_opt_led', 'elec_opt_smart', 'elec_opt_cert',
    'elec_pes_avaria', 'elec_pes_vell', 'elec_pes_tarifa', 'elec_pes_perd'],
  water: ['water_opt_grises', 'water_opt_sensors', 'water_opt_reg', 'water_opt_cistern',
    'water_pes_sequera', 'water_pes_canon', 'water_pes_fuites', 'water_pes_ocup'],
  office: ['office_opt_digi', 'office_opt_dcara', 'office_opt_reuti', 'office_opt_audt',
    'office_pes_creix', 'office_pes_impr', 'office_pes_urgn', 'office_pes_cost'],
  cleaning: ['clean_opt_ecol', 'clean_opt_maqui', 'clean_opt_freq', 'clean_opt_audt',
    'clean_pes_norm', 'clean_pes_desin', 'clean_pes_superf', 'clean_pes_rotat'],
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
    console.error('Error carregant dades (CORS file://), usant dades locals completes:', e);
    DATA = {
      "metadata": {
        "projecte": "Indicadors de Sostenibilitat - Factures ITB Leaks",
        "data_creacio": "2025-03-23",
        "total_factures": 11,
        "nota_duplicat": "F078-MAIG exclosa per ser duplicat de F078-DIGI",
        "indicadors_sostenibilitat": {
          "I1": "Import total amb IVA (€) — impacte econòmic directe",
          "I2": "IVA suportat (€) — cost fiscal / càrrega tributària",
          "I3": "Categoria de despesa — classificació per àmbit de sostenibilitat",
          "I4": "Forma de pagament — traçabilitat i gestió financera responsable"
        }
      },
      "factures": [
        { "id": "F035", "data": "2024-04-30", "proveidor": "Lyreco", "descripcio_resum": "Material oficina: borradors, marcadors, paper A4", "I1_import_total_EUR": 277.13, "I2_iva_suportat_EUR": 48.10, "I3_categoria": "Material Oficina", "I4_forma_pagament": "SEPA DIRECT DEBIT" },
        { "id": "F036", "data": "2024-05-31", "proveidor": "Lyreco", "descripcio_resum": "Material oficina: recanvis pissarra blanca, paper A4", "I1_import_total_EUR": 261.24, "I2_iva_suportat_EUR": 45.34, "I3_categoria": "Material Oficina", "I4_forma_pagament": "SEPA DIRECT DEBIT" },
        { "id": "F039", "data": "2024-09-13", "proveidor": "Proveidor NP", "descripcio_resum": "Treballs ferro i fusta: portes i baranes malmeses", "I1_import_total_EUR": 1012.98, "I2_iva_suportat_EUR": 175.81, "I3_categoria": "Manteniment Instal·lacions", "I4_forma_pagament": "Contado / Recibo" },
        { "id": "F041", "data": "2024-07-05", "proveidor": "Proveidor NP", "descripcio_resum": "Reparació urgent aire condicionat (compressor + filtres)", "I1_import_total_EUR": 348.48, "I2_iva_suportat_EUR": 60.48, "I3_categoria": "Manteniment Instal·lacions", "I4_forma_pagament": "Contado / Recibo" },
        { "id": "F046", "data": "2024-05-23", "proveidor": "Proveidor NP", "descripcio_resum": "Instal·lació elèctrica: circuits QGP/OGP nous amb control lumínic", "I1_import_total_EUR": 2548.02, "I2_iva_suportat_EUR": 442.22, "I3_categoria": "Manteniment Instal·lacions", "I4_forma_pagament": "Contado / Recibo" },
        { "id": "F055", "data": "2024-06-20", "proveidor": "Empresa Neteges", "descripcio_resum": "Subministraments higiene: paper, bosses, sabó", "I1_import_total_EUR": 750.26, "I2_iva_suportat_EUR": 130.21, "I3_categoria": "Neteges i Subministraments", "I4_forma_pagament": "Recibo Domiciliado" },
        { "id": "F056", "data": "2024-05-27", "proveidor": "Empresa Neteges", "descripcio_resum": "Neteja jardí, patis i entrada + transport deixalleria", "I1_import_total_EUR": 454.72, "I2_iva_suportat_EUR": 78.92, "I3_categoria": "Neteges i Subministraments", "I4_forma_pagament": "Recibo Domiciliado" },
        { "id": "F078", "data": "2024-05-01", "proveidor": "DIGI", "descripcio_resum": "Telecomunicacions: fibra òptica 1Gb", "I1_import_total_EUR": 30.00, "I2_iva_suportat_EUR": 5.21, "I3_categoria": "Telecomunicacions", "I4_forma_pagament": "Domiciliació bancària" },
        { "id": "F294", "data": "2024-03-04", "proveidor": "O2 (Telefónica)", "descripcio_resum": "Telecomunicacions: fibra 1Gb + mòbil 200GB", "I1_import_total_EUR": 50.00, "I2_iva_suportat_EUR": 8.68, "I3_categoria": "Telecomunicacions", "I4_forma_pagament": "Domiciliació bancària" },
        { "id": "F327", "data": "2024-06-30", "proveidor": "Lyreco", "descripcio_resum": "Material oficina: recanvis marcadors pissarra negre", "I1_import_total_EUR": 34.36, "I2_iva_suportat_EUR": 5.96, "I3_categoria": "Material Oficina", "I4_forma_pagament": "SEPA DIRECT DEBIT" },
        { "id": "F328", "data": "2024-10-31", "proveidor": "Lyreco", "descripcio_resum": "Material oficina: paper A4 (30 resmes)", "I1_import_total_EUR": 198.56, "I2_iva_suportat_EUR": 34.46, "I3_categoria": "Material Oficina", "I4_forma_pagament": "SEPA DIRECT DEBIT" }
      ],
      "resum_indicadors": {
        "I1_total_despesa_EUR": 5965.75,
        "I2_total_iva_EUR": 1035.39,
        "I3_despesa_per_categoria": {
          "Manteniment Instal·lacions": 3909.48,
          "Neteges i Subministraments": 1204.98,
          "Material Oficina": 771.29,
          "Telecomunicacions": 80.00
        },
        "I4_factures_per_forma_pagament": {
          "SEPA DIRECT DEBIT": 4,
          "Contado / Recibo": 3,
          "Recibo Domiciliado": 2,
          "Domiciliació bancària": 2
        }
      }
    };
    renderKPIs();
    renderCategoryChart();
    renderFacturesTable();
  }
}

// ---- KPI CARDS ----
function renderKPIs() {
  if (!DATA) return;
  const r = DATA.resum_indicadors;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('kpi-total', fmt(r.I1_total_despesa_EUR) + ' €');
  set('kpi-iva', fmt(r.I2_total_iva_EUR) + ' €');
  set('kpi-factures', DATA.metadata?.total_factures || 11);
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
  const cats = DATA.resum_indicadors.I3_despesa_per_categoria;
  const max = Math.max(...Object.values(cats));
  const container = document.getElementById('category-chart');
  if (!container) return;

  container.innerHTML = Object.entries(cats).map(([cat, val]) => `
    <div class="bar-row">
      <div class="bar-label">${cat}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:0" data-target="${(val / max * 100).toFixed(1)}%"></div>
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
    'Material Oficina': 'badge-blue',
    'Manteniment Instal·lacions': 'badge-gold',
    'Manteniment Instal-lacions': 'badge-gold',
    'Neteges i Subministraments': 'badge-green',
    'Telecomunicacions': 'badge-red',
  };

  const catIcon = {
    'Material Oficina': '📄',
    'Manteniment Instal·lacions': '🔧',
    'Manteniment Instal-lacions': '🔧',
    'Neteges i Subministraments': '🧼',
    'Telecomunicacions': '📡',
  };

  tbody.innerHTML = DATA.factures.map(f => {
    const badge = badgeClass[f.I3_categoria] || 'badge-green';
    const icon = catIcon[f.I3_categoria] || '📋';
    return `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
      <td style="padding: 0.85rem 1rem;"><strong style="color: var(--c-blue);">${f.id}</strong></td>
      <td style="padding: 0.85rem 1rem; white-space: nowrap;">${f.data}</td>
      <td style="padding: 0.85rem 1rem; color: var(--c-white);">${f.proveidor}</td>
      <td style="max-width:280px;font-size:0.8rem;color:var(--c-muted); padding: 0.85rem 1rem;">${f.descripcio_resum}</td>
      <td style="padding: 0.85rem 1rem;"><span class="badge ${badge}">${icon} ${f.I3_categoria}</span></td>
      <td style="text-align:right;font-weight:600; padding: 0.85rem 1rem; color: var(--c-white);">${fmt(f.I1_import_total_EUR)} €</td>
      <td style="text-align:right;color:var(--c-muted); padding: 0.85rem 1rem;">${fmt(f.I2_iva_suportat_EUR)} €</td>
      <td style="font-size:0.78rem;color:var(--c-muted); padding: 0.85rem 1rem;">${f.I4_forma_pagament}</td>
    </tr>
  `;
  }).join('');
}

// ---- TABS ----
function initTabs() {
  const tabs = document.querySelectorAll('.calc-tab');
  const panels = document.querySelectorAll('.calc-panel');

  // Estat inicial net
  tabs.forEach(t => t.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  if (tabs[0]) tabs[0].classList.add('active');
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
  const base = BASE_COSTS[type];
  const seasonal = SEASONAL[type];
  const inflation = 0.03;
  const yearAdj = Math.pow(1 + inflation, year - 2024);
  let scenarioFact = SCENARIO_FACTORS[scenario] ?? SCENARIO_META[scenario]?.factor ?? 1.0;
  let customDesc = null;

  if (scenario === 'simulador') {
    const typeMap = { 'electric': 'energia', 'water': 'aigua', 'office': 'consumibles', 'cleaning': 'neteja' };
    const cat = typeMap[type];
    let catVal = 0;
    if (typeof SIMULATOR_ACTIONS !== 'undefined' && SIMULATOR_ACTIONS[cat]) {
      SIMULATOR_ACTIONS[cat].forEach(act => {
        const chk = document.getElementById(act.id);
        if (chk && chk.checked) catVal += act.val;
      });
    }
    scenarioFact = Math.max(0, 1 - (catVal / 100));
    customDesc = `Reducció del ${catVal}% basada en les opcions seleccionades al simulador per a la categoria de ${cat}.`;
  }

  const indices = mode === 'annual'
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];   // set→jun

  let months = [];
  let total = 0;

  for (const i of indices) {
    const val = base * seasonal[i] * yearAdj * scenarioFact;
    months.push({ label: MONTHS_CA[i], value: val });
    total += val;
  }

  return { total, months, yearAdj, scenarioFact, customDesc };
}

// ---- CALCULADORA: renderitzar resultat ----
function renderCalcResult(containerId, type, mode, year, scenario, compareScenario, scenarioSelNode) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { total, months, scenarioFact, customDesc } = calcProjection(type, mode, year, scenario);

  let compTotal = null;
  let compMonths = null;
  let compMeta = null;
  if (compareScenario && compareScenario !== scenario) {
    const comp = calcProjection(type, mode, year, compareScenario);
    compTotal = comp.total;
    compMonths = comp.months;
    compMeta = SCENARIO_META[compareScenario] || { label: 'Comparació' };
  }

  const currentHash = `${year}_${scenario}_${compareScenario}_${total}_${compTotal}`;
  if (container.dataset.lastHash === currentHash) {
    return;
  }
  container.dataset.lastHash = currentHash;

  const modeLabel = mode === 'annual'
    ? `any ${year}`
    : `curs ${year}-${year + 1}`;

  const typeLabels = {
    electric: 'Consum elèctric estimat',
    water: "Consum d'aigua estimat",
    office: "Consumibles d'oficina estimats",
    cleaning: 'Productes de neteja estimats',
  };

  const scenarioMeta = SCENARIO_META[scenario] || { label: 'Base', group: 'base', desc: 'Projecció sense canvis.', factor: 1.0 };
  const scenarioGroup = scenarioMeta.group;
  const finalDesc = customDesc || scenarioMeta.desc;

  const scenarioColors = {
    base: 'var(--c-text)',
    opt: 'var(--c-green)',
    pessimist: 'var(--c-red)',
  };
  const scColor = scenarioColors[scenarioGroup] || 'var(--c-text)';

  container.classList.add('show');

  let optionsHtml = `<option value="">-- Sense comparació --</option>`;
  if (scenarioSelNode) {
    optionsHtml += scenarioSelNode.innerHTML;
  }

  let comparisonHtml = `
    <div style="margin-top:0.75rem; font-size:0.85rem; padding: 0.6rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.1);">
       <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem; gap: 1rem;">
           <span style="color:var(--c-muted)">Comparar amb:</span> 
           <select class="compare-select" style="flex: 1; padding: 0.3rem 0.5rem; background: var(--c-bg); border: 1px solid var(--c-border); color: var(--c-white); border-radius: 4px; font-size: 0.8rem;">
               ${optionsHtml}
           </select>
       </div>
  `;

  if (compMeta && compTotal !== null) {
    const diff = total - compTotal;
    const diffFmt = diff > 0 ? '+' + fmt(diff) : (diff < 0 ? fmt(diff) : '0');
    const diffColor = diff > 0 ? 'var(--c-red)' : 'var(--c-green)';
    comparisonHtml += `
           <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
               <span style="color:var(--c-muted)">Cost d'aquella opció:</span> 
               <strong style="color:var(--c-text)">${fmt(compTotal)} €</strong>
           </div>
           <div style="display:flex; justify-content:space-between;">
               <span style="color:var(--c-muted)">Diferència actual vs comparació:</span> 
               <strong style="color:${diffColor}">${diffFmt} €</strong>
           </div>
      `;
  }
  comparisonHtml += `</div>`;

  container.querySelector('.result-main').textContent = fmt(total) + ' €';
  container.querySelector('.result-label').innerHTML =
    `${typeLabels[type]} per al ${modeLabel} &nbsp;
     <span style="font-size:0.8rem;color:${scColor};font-weight:600">
       · ${scenarioMeta.label}
       (×${scenarioFact.toFixed(2)})
     </span>
     <div style="margin-top:0.5rem;font-size:0.78rem;color:var(--c-muted);font-style:italic">${finalDesc}</div>
     ${comparisonHtml}`;

  const compareSelectNode = container.querySelector('.compare-select');
  if (compareSelectNode) {
    compareSelectNode.value = compareScenario || "";
  }

  // Desglosament mensual
  const breakdown = container.querySelector('.result-breakdown');
  if (breakdown) {
    breakdown.innerHTML = months.map((m, index) => {
      let compHtml = '';
      if (compMonths) {
        compHtml = `<div class="amount" style="color:var(--c-muted); font-size: 0.75rem; margin-top: 2px;">Comp: ${fmt(compMonths[index].value)} €</div>`;
      }
      return `
      <div class="breakdown-item">
        <div class="month">${m.label}</div>
        <div class="amount" style="color:var(--c-white)">${fmt(m.value)} €</div>
        ${compHtml}
      </div>
      `;
    }).join('');
  }

  // Gràfic de barres
  const chartContainer = container.querySelector('.monthly-chart');
  if (chartContainer) {
    const { months: referenceMonths } = calcProjection(type, mode, year, 'all_pes');
    const maxVal = Math.max(...referenceMonths.map(m => m.value));
    const color = getBarColor(type);

    chartContainer.innerHTML = months.map((m, index) => {
      const heightPct = ((m.value / maxVal) * 100).toFixed(1);
      let compBarHtml = '';
      if (compMonths) {
        const pH = ((compMonths[index].value / maxVal) * 100).toFixed(1);
        compBarHtml = `<div class="bar" data-h="${pH}%" style="height: 0%; background: rgba(255,255,255,0.15); width: 40%; margin-right: 2px; flex-shrink: 0; transition: height 0.5s ease-out;" title="Comparació: ${fmt(compMonths[index].value)} €"></div>`;
      }
      return `
        <div class="bar-col">
          <div style="display: flex; align-items: flex-end; height: 100px; width: 100%; justify-content: center; flex: 1;">
            ${compBarHtml}
            <div class="bar" data-h="${heightPct}%" style="
              height: 0%; 
              background: ${color}; 
              transition: height 0.5s ease-out, background 0.5s ease-out;
              width: ${compMonths ? '40%' : '100%'};
              flex-shrink: 0;
            " title="Actual: ${fmt(m.value)} €"></div>
          </div>
          <div class="bar-lbl">${m.label}</div>
        </div>
      `;
    }).join('');

    setTimeout(() => {
      chartContainer.querySelectorAll('.bar').forEach(b => {
        b.style.height = b.dataset.h;
      });
    }, 50);
  }
}

function getBarColor(type) {
  const colors = {
    electric: 'linear-gradient(180deg,#e8c16a,rgba(232,193,106,0.25))',
    water: 'linear-gradient(180deg,#5ca8e8,rgba(92,168,232,0.25))',
    office: 'linear-gradient(180deg,#3ecf74,rgba(62,207,116,0.25))',
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
  'sel-elec-annual-scenario': 'electric',
  'sel-elec-course-scenario': 'electric',
  'sel-water-annual-scenario': 'water',
  'sel-water-course-scenario': 'water',
  'sel-office-annual-scenario': 'office',
  'sel-office-course-scenario': 'office',
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
    ['all_opt', 'all_pes', 'simulador'].forEach(k => {
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

// ---- YEAR STEPPER LOGIC ----
function initYearSteppers() {
  const currentYear = new Date().getFullYear();
  const MIN_YEAR = currentYear;
  const MAX_YEAR = currentYear + 50;

  document.querySelectorAll('.year-stepper').forEach(stepper => {
    const inp = stepper.querySelector('.stepper-input');
    const btnDec = stepper.querySelector('.stepper-dec');
    const btnInc = stepper.querySelector('.stepper-inc');
    if (!inp || !btnDec || !btnInc) return;

    inp.value = currentYear + 1;

    const clamp = y => Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));

    const step = (delta) => {
      const y = clamp((parseInt(inp.value) || currentYear + 1) + delta);
      inp.value = y;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // pointerdown cobreix touch i mouse, i preventDefault evita
    // que el focus passi a l'input (que causaria el teclat a mòbil)
    const addTap = (btn, delta) => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        step(delta);
      });
    };

    addTap(btnDec, -1);
    addTap(btnInc, +1);

    // Només permet dígits mentre s'escriu
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 4);
    });

    // Valida i clampeja en perdre el focus o prémer Enter
    const commit = () => {
      const y = parseInt(inp.value);
      if (!isNaN(y)) {
        inp.value = clamp(y);
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
}

// ---- CALCULADORA HANDLERS ----
// Cada binding: [yearInputId, scenarioSelId, resultId, type, mode]
function bindCalculators() {
  const currentYear = new Date().getFullYear();

  const bindings = [
    ['inp-elec-annual-year', 'sel-elec-annual-scenario', 'res-elec-annual', 'electric', 'annual'],
    ['inp-elec-course-year', 'sel-elec-course-scenario', 'res-elec-course', 'electric', 'course'],
    ['inp-water-annual-year', 'sel-water-annual-scenario', 'res-water-annual', 'water', 'annual'],
    ['inp-water-course-year', 'sel-water-course-scenario', 'res-water-course', 'water', 'course'],
    ['inp-office-annual-year', 'sel-office-annual-scenario', 'res-office-annual', 'office', 'annual'],
    ['inp-office-course-year', 'sel-office-course-scenario', 'res-office-course', 'office', 'course'],
    ['inp-clean-annual-year', 'sel-clean-annual-scenario', 'res-clean-annual', 'cleaning', 'annual'],
    ['inp-clean-course-year', 'sel-clean-course-scenario', 'res-clean-course', 'cleaning', 'course'],
  ];

  bindings.forEach(([yearInpId, scenarioSelId, resId, type, mode]) => {
    const yearInp = document.getElementById(yearInpId);
    const scenarioSel = document.getElementById(scenarioSelId);
    if (!yearInp || !scenarioSel) return;

    let compareScenario = '';

    const doCalc = () => {
      const y = parseInt(yearInp.value);
      if (isNaN(y) || y < currentYear || y > currentYear + 50) return;
      const scenario = scenarioSel.value || 'base';
      renderCalcResult(resId, type, mode, y, scenario, compareScenario, scenarioSel);
    };

    yearInp.addEventListener('change', doCalc);
    scenarioSel.addEventListener('change', doCalc);

    const resContainer = document.getElementById(resId);
    if (resContainer) {
      resContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('compare-select')) {
          compareScenario = e.target.value;
          doCalc();
        }
      });
    }

    // Càlcul inicial automàtic (després que initYearSteppers hagi posat el valor)
    setTimeout(doCalc, 0);
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
  const reductions = { electric: 0.53, water: 0.38, office: 0.37, cleaning: 0.54 };
  const container = document.getElementById('reduction-results');
  if (!container) return;

  const types = [
    { key: 'electric', label: 'Consum Elèctric', icon: '⚡' },
    { key: 'water', label: 'Consum Aigua', icon: '💧' },
    { key: 'office', label: 'Consumibles Oficina', icon: '📄' },
    { key: 'cleaning', label: 'Productes Neteja', icon: '🧹' },
  ];

  let totalBefore = 0, totalAfter = 0;

  const rows = types.map(t => {
    const { total: before } = calcProjection(t.key, 'annual', 2025, 'base');
    const after = before * (1 - reductions[t.key]);
    const saving = before - after;
    totalBefore += before;
    totalAfter += after;
    return `
      <tr>
        <td>${t.icon} ${t.label}</td>
        <td style="text-align:right">${fmt(before)} €</td>
        <td style="text-align:right;color:var(--c-green)">${fmt(after)} €</td>
        <td style="text-align:right;color:var(--c-gold);font-weight:700">−${fmt(saving)} €</td>
        <td style="text-align:right"><span class="badge badge-green">−${(reductions[t.key] * 100).toFixed(0)}%</span></td>
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
              <span class="badge badge-green">−${((totalSaving / totalBefore) * 100).toFixed(1)}%</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// ---- CRONOGRAMA GRÀFIC v2 ----
function renderTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  // Temporització realista: startM/endM = número de mes dins els 36 mesos del pla
  // Mes 1 = Setembre any 1, Mes 12 = Agost any 2, Mes 36 = Agost any 3
  const phases = [
    {
      id: 'f1',
      phase: 'Fase 1 — Accions immediates',
      period: 'Mesos 1–6  ·  Set → Feb',
      desc: 'Sense inversió gran: canvis de comportament, substitució de material i sensors bàsics.',
      color: '#10b981',
      icon: '⚡',
      actions: [
        { icon: '💡', label: 'LED + sensors presència', saving: '−20% elèctric', startM: 1, endM: 3 },
        { icon: '📋', label: 'Impressió doble cara', saving: '−17% oficina', startM: 1, endM: 2 },
        { icon: '🔬', label: 'Auditoria processos neteja', saving: '−6% neteja', startM: 2, endM: 4 },
        { icon: '🚿', label: 'Cisternes i airejadors', saving: '−7% aigua', startM: 3, endM: 6 },
      ]
    },
    {
      id: 'f2',
      phase: 'Fase 2 — Millores planificades',
      period: 'Mesos 7–18  ·  Mar → Ago any 2',
      desc: 'Inversió moderada amb retorn en 1–2 anys: sistemes de gestió i digitalització.',
      color: '#f59e0b',
      icon: '🌱',
      actions: [
        { icon: '🔌', label: 'Gestió intel·ligent consum', saving: '−15% elèctric', startM: 7, endM: 10 },
        { icon: '📱', label: 'Digitalització total oficina', saving: '−28% oficina', startM: 7, endM: 12 },
        { icon: '🔍', label: 'Sensors de fuites', saving: '−18% aigua', startM: 10, endM: 13 },
        { icon: '🌿', label: 'Productes ecològics conc.', saving: '−22% neteja', startM: 12, endM: 18 },
      ]
    },
    {
      id: 'f3',
      phase: 'Fase 3 — Infraestructura verda',
      period: 'Mesos 19–36  ·  Set any 2 → Ago any 3',
      desc: 'Gran inversió amb retorn a llarg termini i màxim impacte en sostenibilitat.',
      color: '#3b82f6',
      icon: '🚀',
      actions: [
        { icon: '♻️', label: 'Recuperació aigües grises', saving: '−30% aigua', startM: 19, endM: 24 },
        { icon: '🤖', label: 'Maquinària alta eficiència', saving: '−16% neteja', startM: 20, endM: 26 },
        { icon: '🏷️', label: 'Certificació energètica A+', saving: '−10% elèctric', startM: 22, endM: 30 },
        { icon: '☀️', label: 'Panells fotovoltaics', saving: '−32% elèctric', startM: 28, endM: 36 },
      ]
    },
  ];

  // Calcula estalvi total estimat
  const yr = new Date().getFullYear() + 1;
  const totalBase = Object.keys(BASE_COSTS).reduce((s, k) => s + calcProjection(k, 'annual', yr, 'base').total, 0);
  const totalOpt = Object.keys(BASE_COSTS).reduce((s, k) => s + calcProjection(k, 'annual', yr, 'all_opt').total, 0);
  const totalSaving = totalBase - totalOpt;
  const savingPct = ((totalSaving / totalBase) * 100).toFixed(0);

  // Etiquetes de la regla de mesos (36 mesos, trimestrals)
  const startMonth = 9; // Setembre
  const monthNames = ['', 'Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];
  const rulerCells = Array.from({ length: 36 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const isQ = (i % 3 === 0);
    return `<div class="tl-ruler-month${isQ ? ' quarter-start' : ''}">${isQ ? monthNames[m] : ''}</div>`;
  }).join('');

  // Files del diagrama Gantt (una per acció)
  const ganttOpacity = ['0.90', '0.75', '0.62', '0.50'];
  const ganttRows = phases.flatMap((p, pi) =>
    p.actions.map((a, ai) => {
      // Convertim a percentatge del total de 36 mesos
      const left = (((a.startM - 1) / 36) * 100).toFixed(2);
      const width = (((a.endM - a.startM + 1) / 36) * 100).toFixed(2);
      // Color amb opacitat decreixent per cada acció dins la fase
      const hex = p.color;
      return `<div class="tl-gantt-row" title="${a.label} · Mes ${a.startM}–${a.endM}">
        <div class="tl-gantt-bar" style="left:${left}%;width:${width}%;background:${hex};opacity:${ganttOpacity[ai]};">
          ${a.icon} ${a.label}
        </div>
      </div>`;
    })
  ).join('');

  // Targetes de fase
  const phaseBlocks = phases.map(p => `
    <div class="tl-phase-block" style="--phase-color:${p.color}">
      <div class="tl-phase-head">
        <div class="tl-phase-icon">${p.icon}</div>
        <div>
          <div class="tl-phase-title">${p.phase}</div>
          <div class="tl-phase-period">${p.period}</div>
          <div class="tl-phase-desc">${p.desc}</div>
        </div>
      </div>
      <div class="tl-phase-cards">
        ${p.actions.map(a => `
          <div class="tl-card">
            <div class="tl-card-icon">${a.icon}</div>
            <div style="min-width:0">
              <div class="tl-card-label">${a.label}</div>
              <div class="tl-card-meta">
                <span class="tl-card-saving">${a.saving}</span>
                <span class="tl-card-month">Mes ${a.startM}–${a.endM}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="tl-summary">
      <div class="tl-summary-stat">
        <div class="tl-summary-stat-label">Estalvi potencial total</div>
        <div class="tl-summary-stat-val">−${fmt(totalSaving)} € <span>/ any</span></div>
      </div>
      <div class="tl-summary-divider"></div>
      <div class="tl-summary-stat">
        <div class="tl-summary-stat-label">Reducció estimada</div>
        <div class="tl-summary-stat-val" style="color:#10b981">−${savingPct}%</div>
      </div>
      <div class="tl-summary-divider"></div>
      <div class="tl-summary-progress">
        <div class="tl-summary-progress-label">Progrés del pla</div>
        <div class="tl-progress-track">
          <div class="tl-progress-fill" data-target="${savingPct}%"></div>
        </div>
        <div class="tl-progress-hint">3 fases · 12 accions · 36 mesos</div>
      </div>
    </div>

    <div style="margin-bottom:2rem">
      <div style="font-size:0.75rem;font-weight:600;color:var(--c-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:0.75rem">
        📅 Diagrama temporal — 36 mesos (Set any 1 → Ago any 3)
      </div>
      <div class="tl-ruler-wrap">
        <div class="tl-ruler">
          <div class="tl-ruler-months">${rulerCells}</div>
          <div class="tl-gantt-rows">${ganttRows}</div>
        </div>
      </div>
    </div>

    <div class="tl-phases">${phaseBlocks}</div>
  `;

  // Anima la barra de progrés
  const bar = container.querySelector('.tl-progress-fill');
  if (bar) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { bar.style.width = bar.dataset.target; obs.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    obs.observe(bar);
  }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  try { await loadData(); } catch (e) { console.error('loadData:', e); }
  try { initTabs(); } catch (e) { console.error('initTabs:', e); }
  try { initAccordions(); } catch (e) { console.error('initAccordions:', e); }
  try { initScrollAnimations(); } catch (e) { console.error('initScrollAnimations:', e); }
  try { initNavScroll(); } catch (e) { console.error('initNavScroll:', e); }
  try { populateScenarioSelects(); } catch (e) { console.error('populateScenarioSelects:', e); }
  try { initYearSteppers(); } catch (e) { console.error('initYearSteppers:', e); }
  try { bindCalculators(); } catch (e) { console.error('bindCalculators:', e); }
  try { initProgressBars(); } catch (e) { console.error('initProgressBars:', e); }
  try { calcWithReductions(); } catch (e) { console.error('calcWithReductions:', e); }
  try { renderTimeline(); } catch (e) { console.error('renderTimeline:', e); }
  try { initSimulator(); } catch (e) { console.error('initSimulator:', e); }

  setTimeout(() => {
    document.querySelectorAll('.hero-stat .val').forEach(el => {
      if (el) el.style.opacity = '1';
    });
  }, 500);

  // Init PDF Export
  const exportBtns = document.querySelectorAll('.btn-export-pdf');
  exportBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      window.print();
    });
  });

  // Menú hamburguesa
  const menuBtn = document.querySelector('.nav-mobile-btn');
  const navLinks = document.querySelector('.nav-links');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => navLinks.classList.toggle('show'));
  }
});

// ---- SIMULADOR D'ACCIONS DE REDUCCIÓ ----
const SIMULATOR_ACTIONS = {
  energia: [
    { id: 'sim-e1', icon: '💡', label: 'Substitució il·luminació per LED', val: 14, time: 'Any 1', desc: 'Canvi de fluorescents a LEDs en aules i passadissos. Reducció del 40% en il·luminació.', ods: 'ODS 7' },
    { id: 'sim-e2', icon: '⚡', label: 'Substitució circuits elèctrics (F046)', val: 10, time: 'Any 1-2', desc: 'Optimització del 15% del consum elèctric total. Inversió ja realitzada: 2.548,02 €.', ods: 'ODS 7' },
    { id: 'sim-e3', icon: '🌡️', label: 'Control intel·ligent de termostats', val: 9, time: 'Any 1', desc: 'Programació horària de calefacció/AC. Apagat automàtic fora d\'hores lectives.', ods: 'ODS 7' },
    { id: 'sim-e4', icon: '☀️', label: 'Instal·lació de plaques solars fotovoltaiques', val: 20, time: 'Any 2-3', desc: 'Autoconsum energètic del 20% de la demanda elèctrica anual del centre.', ods: 'ODS 7' }
  ],
  aigua: [
    { id: 'sim-a1', icon: '💧', label: 'Tall automàtic d\'aigua nocturna', val: 22, time: 'Any 1', desc: 'Elimina la fuga de 193 L/h durant 8h nocturnes. Estalvi directe sobre consum d\'aigua.', ods: 'ODS 6' },
    { id: 'sim-a2', icon: '🔧', label: 'Revisió i manteniment de xarxes d\'aigua', val: 8, time: 'Any 2', desc: 'Inspecció de canonades, aixetes i cisternes. Reducció addicional del 10% de fuites.', ods: 'ODS 6' },
    { id: 'sim-a3', icon: '📡', label: 'Sensors de presència als lavabos', val: 8, time: 'Any 2-3', desc: 'Tancar automàticament l\'aigua si no hi ha moviment. Estalvi addicional del 8%.', ods: 'ODS 6' }
  ],
  consumibles: [
    { id: 'sim-c1', icon: '♻️', label: 'Economia Circular consumibles (F036)', val: 22, time: 'Any 1-3', desc: 'Ús de recanvis de marcadors i paper reciclat. Reducció del 30% en consumibles.', ods: 'ODS 12' },
    { id: 'sim-c2', icon: '📱', label: 'Digitalització de documents', val: 15, time: 'Any 1-2', desc: 'Reducció del 50% d\'impressions mitjançant plataformes digitals i aules virtuals.', ods: 'ODS 12' }
  ],
  neteja: [
    { id: 'sim-n1', icon: '🧼', label: 'Neteja a granel i reducció d\'envasos', val: 22, time: 'Any 1', desc: 'Substitució per productes ecològics i compra a granel. Reducció del 22%.', ods: 'ODS 3' },
    { id: 'sim-n2', icon: '🤖', label: 'Maquinària d\'alta eficiència', val: 16, time: 'Any 2', desc: 'Inversió en fregadores automàtiques i aspiradores industrials eficients.', ods: 'ODS 8' },
    { id: 'sim-n3', icon: '📅', label: 'Optimització de freqüència', val: 10, time: 'Any 1', desc: 'Revisió dels circuits de neteja per optimitzar la freqüència d\'intervenció.', ods: 'ODS 12' },
    { id: 'sim-n4', icon: '🔬', label: 'Auditoria de processos', val: 6, time: 'Any 1', desc: 'Auditoria completa dels processos per identificar duplicitats.', ods: 'ODS 12' }
  ]
};

function initSimulator() {
  const renderList = (category, items) => {
    const container = document.getElementById(`sim-actions-${category}`);
    if (!container) return;

    container.innerHTML = items.map(act => `
      <div class="sim-action-card" style="background: rgba(255,255,255,0.03); border: 1px solid var(--c-border); border-radius: 12px; padding: 1.1rem; margin-bottom: 0.85rem; display: flex; gap: 0.85rem; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'LABEL') { document.getElementById('${act.id}').click(); }" id="card-${act.id}">
        <div style="padding-top: 2px;">
          <input type="checkbox" id="${act.id}" class="sim-chk" style="width: 1.2rem; height: 1.2rem; accent-color: var(--c-blue); cursor: pointer;" checked>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
            <label for="${act.id}" style="font-size: 0.95rem; font-weight: 600; color: var(--c-white); cursor: pointer; line-height: 1.3; flex: 1; min-width: 140px; overflow-wrap: break-word;">${act.icon} ${act.label}</label>
            <span style="background: rgba(255,255,255,0.1); color: var(--c-gold); font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 6px; white-space: nowrap; font-weight: 700;">-${act.val}% · ${act.time}</span>
          </div>
          <p style="font-size: 0.78rem; color: var(--c-muted); line-height: 1.5; margin-bottom: 0; overflow-wrap: break-word;">
            ${act.desc} <span style="color: var(--c-blue); font-weight: 500;">${act.ods}</span>
          </p>
        </div>
      </div>
    `).join('');
  };

  Object.entries(SIMULATOR_ACTIONS).forEach(([cat, items]) => {
    renderList(cat, items);
  });

  document.querySelectorAll('.sim-chk').forEach(chk => {
    chk.addEventListener('change', updateSimulatorProgress);
  });

  const btnActivate = document.getElementById('btn-activate-all');
  const btnDeactivate = document.getElementById('btn-deactivate-all');

  if (btnActivate) {
    btnActivate.addEventListener('click', () => {
      document.querySelectorAll('.sim-chk').forEach(chk => { chk.checked = true; });
      updateSimulatorProgress();
    });
  }

  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', () => {
      document.querySelectorAll('.sim-chk').forEach(chk => { chk.checked = false; });
      updateSimulatorProgress();
    });
  }

  // Initial update
  updateSimulatorProgress();
}

function updateSimulatorProgress() {
  let totalVal = 0;

  Object.values(SIMULATOR_ACTIONS).forEach(items => {
    items.forEach(act => {
      const chk = document.getElementById(act.id);
      if (chk && chk.checked) {
        totalVal += act.val;
      }
    });
  });

  // Escalat proporcional perquè el 100% de les accions (45.5% de mitjana simple)
  // equivalgui al 49.6% d'estalvi econòmic real ponderat.
  const progressPercent = (totalVal / 4) * (49.6 / 45.5);

  const textEl = document.getElementById('sim-progress-text');
  const barEl = document.getElementById('sim-progress-bar');

  if (textEl) textEl.textContent = progressPercent.toFixed(1) + '%';
  if (barEl) {
    let barWidth = (progressPercent / 49.6) * 100;
    if (barWidth > 100) barWidth = 100;
    barEl.style.width = barWidth + '%';

    if (progressPercent >= 30) {
      barEl.style.background = 'var(--c-green)';
      textEl.style.color = 'var(--c-green)';
    } else {
      barEl.style.background = 'var(--c-blue)';
      textEl.style.color = 'var(--c-blue)';
    }
  }

  // Update card styles
  Object.values(SIMULATOR_ACTIONS).forEach(items => {
    items.forEach(act => {
      const chk = document.getElementById(act.id);
      const card = document.getElementById(`card-${act.id}`);
      if (chk && card) {
        if (chk.checked) {
          card.style.borderColor = 'rgba(59, 130, 246, 0.4)';
          card.style.background = 'rgba(59, 130, 246, 0.05)';
        } else {
          card.style.borderColor = 'var(--c-border)';
          card.style.background = 'rgba(255,255,255,0.03)';
        }
      }
    });
  });

  // Dispara el recàlcul a la calculadora si hi ha algun select (principal o de comparació) amb l'opció "simulador"
  const selects = document.querySelectorAll('select[id^="sel-"]');
  selects.forEach(sel => {
    const panel = sel.closest('.calc-panel');
    const compareSel = panel ? panel.querySelector('.compare-select') : null;
    if (sel.value === 'simulador' || (compareSel && compareSel.value === 'simulador')) {
      sel.dispatchEvent(new Event('change'));
    }
  });
}