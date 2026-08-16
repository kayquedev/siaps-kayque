// ─────────────────────────────────────────────
//  AUTENTICAÇÃO
// ─────────────────────────────────────────────
const CREDENCIAIS = { usuario: '13368602608', senha: 'Kagente25' };

function tentarLogin(ev) {
  ev.preventDefault();
  const usuario = document.getElementById('login-usuario').value.trim();
  const senha   = document.getElementById('login-senha').value;
  const erro    = document.getElementById('login-erro');

  if (usuario === CREDENCIAIS.usuario && senha === CREDENCIAIS.senha) {
    sessionStorage.setItem('siaps_auth', '1');
    erro.textContent = '';
    document.getElementById('tela-login').style.display   = 'none';
    document.getElementById('tela-inicial').style.display = 'flex';
  } else {
    erro.textContent = 'Usuário ou senha incorretos.';
    document.getElementById('login-senha').value = '';
  }
}

function sair() {
  sessionStorage.removeItem('siaps_auth');
  document.getElementById('tela-modulo').style.display   = 'none';
  document.getElementById('tela-inicial').style.display  = 'none';
  document.getElementById('login-usuario').value    = '';
  document.getElementById('login-senha').value      = '';
  document.getElementById('login-erro').textContent = '';
  document.getElementById('tela-login').style.display = 'flex';
}

function initAuth() {
  if (sessionStorage.getItem('siaps_auth') === '1') {
    document.getElementById('tela-login').style.display   = 'none';
    document.getElementById('tela-inicial').style.display = 'flex';
  }
}

// ─────────────────────────────────────────────
//  NAVEGAÇÃO ENTRE TELAS
// ─────────────────────────────────────────────
function abrirModulo(id) {
  if (!MODULOS[id]) return;
  moduloAtivo = id;
  document.getElementById('tela-inicial').style.display = 'none';
  document.getElementById('tela-modulo').style.display  = 'flex';
  configurarModulo(id);
}

function configurarModulo(id) {
  const cfg = MODULOS[id];
  // Topbar
  document.getElementById('mod-titulo').textContent = cfg.titulo;
  // Legenda
  document.getElementById('legenda-criterios').innerHTML = cfg.criterios.map(c =>
    `<div style="display:flex;align-items:flex-start;gap:8px">
      <span style="font-size:11px;font-weight:800;color:var(--azul);min-width:16px">${c.k}</span>
      <span style="font-size:11px;color:var(--muted)">${c.desc} <strong>(${c.pts} pts)</strong></span>
     </div>`
  ).join('') +
  `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--cinza-borda);font-size:11px;color:var(--muted)">
    Pontuação máxima: <strong>100 pts</strong> · critérios independentes entre si
   </div>`;
  // Popular select de critério
  const selCrit = document.getElementById('fil-criterio');
  selCrit.innerHTML = '<option value="">Qualquer critério</option>';
  cfg.criterios.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.k;
    opt.textContent = `${c.k} — ${c.desc.substring(0,35)}`;
    selCrit.appendChild(opt);
  });
  // Atualizar label da legenda
  document.getElementById('legenda-titulo').textContent =
    `Critérios ${moduloAtivo.toUpperCase()}`;
  limpar();
}
function voltarInicio() {
  document.getElementById('tela-modulo').style.display  = 'none';
  document.getElementById('tela-inicial').style.display = 'flex';
}

// ─────────────────────────────────────────────
//  IMPRESSÃO PDF
// ─────────────────────────────────────────────
function imprimirPDF() {
  // Atualizar cabeçalho de impressão
  const total    = merged.length;
  const completo = merged.filter(r => r.pontos === 100).length;
  const pend     = merged.filter(r => r.pontos === 0).length;
  const sem      = merged.filter(r => r.sem_cadastro).length;
  const dt = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('print-titulo').textContent =
    `${MODULOS[moduloAtivo].titulo} · Lista Nominal`;

  document.getElementById('print-subtitulo').textContent =
    `Gerado em ${dt} · Exibindo ${filtered.length} de ${total} registros`;

  document.getElementById('print-stats').innerHTML =
    `<span>Total: <strong>${total}</strong></span>` +
    `<span>Sem cadastro: <strong>${sem}</strong></span>` +
    `<span>Completos: <strong>${completo} (${pct(completo,total)}%)</strong></span>` +
    `<span>Pendentes: <strong>${pend} (${pct(pend,total)}%)</strong></span>`;

  // Temporariamente mostrar TODOS os registros filtrados para impressão
  const savedPage = page;
  const savedPageSize = PAGE_SIZE;
  window._printAll = true;
  renderTable();
  setTimeout(() => {
    window.print();
    window._printAll = false;
    page = savedPage;
    renderTable();
  }, 200);
}

// ─────────────────────────────────────────────
//  CONFIGURAÇÃO DOS MÓDULOS
// ─────────────────────────────────────────────
const MODULOS = {
  c6: {
    titulo: 'C6 — Cuidado da Pessoa Idosa',
    criterios: [
      { k: 'A', desc: 'Consulta médica ou de enfermagem', pts: 25 },
      { k: 'B', desc: 'Peso e altura (antropometria)', pts: 25 },
      { k: 'C', desc: 'Visita ACS/TACS (intervalo ≥30 dias)', pts: 25 },
      { k: 'D', desc: 'Vacina influenza (campanha vigente)', pts: 25 },
    ],
  },
  c2: {
    titulo: 'C2 — Cuidado no Desenvolvimento Infantil',
    criterios: [
      { k: 'A', desc: 'Consulta médica ou de enfermagem', pts: 20 },
      { k: 'B', desc: '9 consultas médicas/enf. até os 2 anos de vida', pts: 20 },
      { k: 'C', desc: '9 registros de peso+altura até os 2 anos de vida', pts: 20 },
      { k: 'D', desc: '2 visitas de ACS/TACS', pts: 20 },
      { k: 'E', desc: 'Vacinas em dia', pts: 20 },
    ],
  },
  c5: {
    titulo: 'C5 — Controle da Hipertensão Arterial',
    criterios: [
      { k: 'A', desc: 'Consulta presencial ou remota por médica(o) ou enfermeira(o), nos últimos 6 meses', pts: 25 },
      { k: 'B', desc: 'Aferição de pressão arterial registrada nos últimos 6 meses', pts: 25 },
      { k: 'C', desc: 'Registro simultâneo de peso e altura nos últimos 12 meses', pts: 25 },
      { k: 'D', desc: '2 visitas domiciliares de ACS/TACS (intervalo ≥30 dias) nos últimos 12 meses', pts: 25 },
    ],
  },
  c4: {
    titulo: 'C4 — Controle da Diabetes Mellitus',
    criterios: [
      { k: 'A', desc: 'Consulta presencial ou remota por médica(o) ou enfermeira(o), nos últimos 6 meses', pts: 20 },
      { k: 'B', desc: 'Aferição de pressão arterial registrada nos últimos 6 meses', pts: 15 },
      { k: 'C', desc: 'Registro de peso e altura nos últimos 12 meses', pts: 15 },
      { k: 'D', desc: '2 visitas domiciliares de ACS/TACS (intervalo ≥30 dias) nos últimos 12 meses', pts: 20 },
      { k: 'E', desc: 'Hemoglobina Glicada solicitada ou avaliada nos últimos 12 meses', pts: 15 },
      { k: 'F', desc: 'Avaliação dos pés realizada nos últimos 12 meses', pts: 15 },
    ],
  },
};
// colsCrit é derivado automaticamente da lista de critérios de cada módulo
Object.values(MODULOS).forEach(cfg => { cfg.colsCrit = cfg.criterios.map(c => c.k); });

// ─────────────────────────────────────────────
//  DASHBOARD GERAL MUNICIPAL
//  Valores ilustrativos (dados de exemplo) — os
//  indicadores C2, C4, C5 e C6 já têm ferramenta
//  funcional (cruzamento real via upload); os
//  demais serão integrados a partir das planilhas
//  do SIAPS.
// ─────────────────────────────────────────────
const INDICADORES_MUNICIPAIS = [
  { grupo: 'ESF / eAP', codigo: 'C1', nome: 'Mais Acesso à APS', tipo: 'percentual', valor: 62,
    desc: 'Atendimentos agendados vs. demanda espontânea', moduloId: null },
  { grupo: 'ESF / eAP', codigo: 'C2', nome: 'Desenvolvimento Infantil', tipo: 'score', valor: 74,
    desc: '0–24 meses · 5 boas práticas (20 pts cada)', moduloId: 'c2' },
  { grupo: 'ESF / eAP', codigo: 'C3', nome: 'Gestação e Puerpério', tipo: 'score', valor: 58,
    desc: 'Pré-natal e puerpério · 11 boas práticas', moduloId: null },
  { grupo: 'ESF / eAP', codigo: 'C4', nome: 'Diabetes', tipo: 'score', valor: 71,
    desc: '6 boas práticas · pontuação variável por critério', moduloId: 'c4' },
  { grupo: 'ESF / eAP', codigo: 'C5', nome: 'Hipertensão', tipo: 'score', valor: 69,
    desc: '4 boas práticas · 25 pts cada', moduloId: 'c5' },
  { grupo: 'ESF / eAP', codigo: 'C6', nome: 'Cuidado da Pessoa Idosa', tipo: 'score', valor: 81,
    desc: '≥60 anos · 4 boas práticas · 25 pts cada', moduloId: 'c6' },
  { grupo: 'ESF / eAP', codigo: 'C7', nome: 'Cuidado da Mulher', tipo: 'score', valor: 55,
    desc: 'Colo do útero, HPV, saúde sexual e mamografia por faixa etária', moduloId: null },

  { grupo: 'eMulti', codigo: 'M1', nome: 'Média de Atendimentos pela eMulti', tipo: 'media', valor: 3.4,
    desc: 'Atendimentos + atividades coletivas por pessoa (janela de 4 meses)', moduloId: null },
  { grupo: 'eMulti', codigo: 'M2', nome: 'Ações Interprofissionais Compartilhadas', tipo: 'percentual', valor: 47,
    desc: 'Ações com 2+ profissionais ou cuidado compartilhado', moduloId: null },

  { grupo: 'Saúde Bucal (eSB)', codigo: 'B1', nome: '1ª Consulta Odontológica Programática', tipo: 'percentual', valor: 38,
    desc: 'Primeira consulta programática por cirurgião-dentista', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B2', nome: 'Tratamento Concluído', tipo: 'percentual', valor: 64,
    desc: 'Dentro da coorte com 1ª consulta programática', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B3', nome: 'Taxa de Exodontia', tipo: 'percentual', valor: 12,
    desc: 'Exodontias sobre o total de procedimentos odontológicos', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B4', nome: 'Escovação Supervisionada', tipo: 'percentual', valor: 29,
    desc: 'Crianças de 6–12 anos em atividade coletiva', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B5', nome: 'Procedimentos Preventivos', tipo: 'percentual', valor: 53,
    desc: 'Preventivos sobre o total de procedimentos individuais', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B6', nome: 'TRA/ART', tipo: 'percentual', valor: 8,
    desc: 'Tratamento Restaurador Atraumático sobre procedimentos restauradores', moduloId: null },
];

const CVAT_EXEMPLO = {
  pontuacao: 6.4, max: 10,
  dimensoes: [
    { label: 'Cadastro (30%)', pts: 2.1, max: 3 },
    { label: 'Acompanhamento territorial (70%)', pts: 4.3, max: 7 },
  ],
};

function classificarIndic(tipo, valor) {
  if (tipo === 'media') return 'neutro';
  if (valor >= 75) return 'bom';
  if (valor >= 50) return 'regular';
  return 'atencao';
}

function renderDashboard() {
  const alvo = document.getElementById('dashboard-municipal');
  if (!alvo) return;

  // KPIs gerais (ilustrativos)
  const comScore = INDICADORES_MUNICIPAIS.filter(i => i.tipo !== 'media');
  const media = Math.round(comScore.reduce((s, i) => s + i.valor, 0) / comScore.length);
  const competencia = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let html = `
    <div class="dash-disclaimer">
      ⚠️ <span><strong>Valores ilustrativos.</strong> C2, C4, C5 e C6 já possuem ferramenta funcional com dados reais via upload — clique no card para acessar. Os demais indicadores serão integrados a partir das planilhas do SIAPS.</span>
    </div>
    <div class="dash-kpis">
      <div class="kpi-tile">
        <div class="kpi-label">Média geral dos indicadores</div>
        <div class="kpi-value">${media}<span class="unit">%</span></div>
        <div class="kpi-sub">15 indicadores acompanhados</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Equipes cadastradas</div>
        <div class="kpi-value">19</div>
        <div class="kpi-sub">12 ESF/eAP · 4 eSB · 3 eMulti</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">População coberta (estimada)</div>
        <div class="kpi-value">34.5<span class="unit">mil</span></div>
        <div class="kpi-sub">cadastros ativos no território</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Competência de referência</div>
        <div class="kpi-value" style="font-size:18px;text-transform:capitalize">${competencia}</div>
      </div>
    </div>`;

  // Agrupar indicadores mantendo a ordem de inserção
  const grupos = new Map();
  INDICADORES_MUNICIPAIS.forEach(ind => {
    if (!grupos.has(ind.grupo)) grupos.set(ind.grupo, []);
    grupos.get(ind.grupo).push(ind);
  });

  grupos.forEach((itens, grupo) => {
    html += `<div class="dash-group">
      <div class="dash-group-header">
        <h3>${grupo}</h3>
        <span>${itens.length} indicador${itens.length > 1 ? 'es' : ''}</span>
      </div>
      <div class="indic-grid">`;

    itens.forEach(ind => {
      const cls = classificarIndic(ind.tipo, ind.valor);
      const unidade = ind.tipo === 'percentual' ? '%' : ind.tipo === 'score' ? ' pts' : '';
      const pctBarra = ind.tipo === 'media' ? Math.min(100, ind.valor / 5 * 100) : ind.valor;
      const clicavel = !!ind.moduloId;
      const onclick = clicavel ? ` onclick="abrirModulo('${ind.moduloId}')"` : '';

      html += `<div class="indic-card${clicavel ? ' clickable' : ''}"${onclick} title="${ind.desc}">
        <div class="indic-card-top">
          <span class="indic-code">${ind.codigo}</span>
          <span class="indic-tag ${clicavel ? 'ativo' : 'breve'}">${clicavel ? 'Ferramenta ativa' : 'Em breve'}</span>
        </div>
        <div class="indic-value ${cls}"><span class="num">${ind.valor}</span><span class="unit">${unidade}</span></div>
        <div class="indic-name">${ind.nome}</div>
        <div class="indic-desc">${ind.desc}</div>
        <div class="indic-bar"><div class="indic-bar-fill ${cls}" style="width:${pctBarra}%"></div></div>
        ${clicavel ? `<div class="indic-link">Acessar lista nominal →</div>` : ''}
      </div>`;
    });

    html += `</div></div>`;
  });

  // CVAT — card em destaque
  html += `<div class="dash-group">
    <div class="dash-group-header">
      <h3>Vínculo e Acompanhamento Territorial (CVAT)</h3>
      <span>escore 0–10</span>
    </div>
    <div class="cvat-card" title="Cadastro: FCI e ficha de domicílio atualizadas em 24 meses. Acompanhamento: 2+ contatos em 12 meses.">
      <div class="cvat-score">
        <div class="num">${CVAT_EXEMPLO.pontuacao}</div>
        <div class="max">de ${CVAT_EXEMPLO.max}</div>
      </div>
      <div class="cvat-dims">
        ${CVAT_EXEMPLO.dimensoes.map(d => `
          <div class="cvat-dim-row">
            <span class="cvat-dim-label">${d.label}</span>
            <div class="cvat-dim-bar"><div class="cvat-dim-fill" style="width:${d.pts / d.max * 100}%"></div></div>
            <span class="cvat-dim-pts">${d.pts}/${d.max}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>`;

  alvo.innerHTML = html;
}

// ─────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────
let moduloAtivo = 'c6';
let rawSiaps = null;
let rawVinc  = null;
let merged   = [];
let filtered = [];
let sortCol  = null;
let sortAsc  = true;
let page     = 0;
const PAGE_SIZE = 100;

// ─────────────────────────────────────────────
//  NORMALIZAÇÃO DE CPF
// ─────────────────────────────────────────────
function normCPF(v) {
  if (!v && v !== 0) return '';
  return String(v).replace(/\D/g, '').padStart(11, '0');
}

// ─────────────────────────────────────────────
//  CÁLCULO DE IDADE
// ─────────────────────────────────────────────
// Aceita datas em DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD
function calcIdade(dataStr) {
  if (!dataStr) return null;
  const partes = String(dataStr).trim().split(/[\/\-]/);
  if (partes.length !== 3) return null;
  let d, m, y;
  if (partes[0].length === 4) { y = +partes[0]; m = +partes[1]; d = +partes[2]; }
  else { d = +partes[0]; m = +partes[1]; y = +partes[2]; }
  if (!y || !m || !d) return null;
  const nascimento = new Date(y, m - 1, d);
  if (isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

// ─────────────────────────────────────────────
//  DRAG & DROP
// ─────────────────────────────────────────────
function ev(e, tipo, enter) {
  e.preventDefault();
  document.getElementById('card-' + (tipo === 'siaps' ? 'siaps' : 'vinc'))
    .classList.toggle('dragover', enter);
}
function drop(e, tipo) {
  e.preventDefault();
  ev(e, tipo, false);
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file, tipo);
}
function loadFile(e, tipo) {
  const file = e.target.files[0];
  if (file) parseFile(file, tipo);
}

// ─────────────────────────────────────────────
//  PARSE DE ARQUIVOS
// ─────────────────────────────────────────────
function parseFile(file, tipo) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (tipo === 'siaps') parseSiaps(raw, file.name);
      else parseVinc_xlsx(raw, file.name);
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bytes = new Uint8Array(ev.target.result);
      const decoder = new TextDecoder('windows-1252');
      const text = decoder.decode(bytes);
      const allLines = text.split('\n');
      let sep = ';';
      for (const l of allLines) {
        if (l.trim().length > 10) {
          sep = l.split(';').length >= l.split(',').length ? ';' : ',';
          break;
        }
      }
      const res = Papa.parse(text, { delimiter: sep, quoteChar: '"', skipEmptyLines: false });
      if (tipo === 'siaps') parseSiaps(res.data, file.name);
      else parseVinc_csv(res.data, file.name);
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseSiaps(rows, nome) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => String(c).trim() === 'CPF')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { alert('Arquivo SIAPS: não encontrei linha com "CPF". Verifique o arquivo.'); return; }
  const headers = rows[headerIdx].map(h => String(h).trim());
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]).trim() : ''; });
    if (!obj['CPF'] && !obj['CNS']) continue;
    obj['_cpf_norm'] = normCPF(obj['CPF'] || obj['CNS']);
    data.push(obj);
  }
  rawSiaps = data;
  setStatus('siaps', `✅ ${data.length} registros`, nome);
  checkReady();
}

function parseVinc_csv(rows, nome) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i]) || rows[i].length < 4) continue;
    const normalized = rows[i].map(c => String(c).trim().replace(/['"\u00ef\u00bb\u00bf]/g, ''));
    if (normalized.some(c => c === 'CPF/CNS' || c === 'CPF')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    const preview = rows.slice(0, 20).map((r, i) =>
      `L${i+1}[${Array.isArray(r)?r.length:0}]: ${JSON.stringify((r||[]).slice(0,4))}`
    ).join('\n');
    alert('Não encontrei a coluna "CPF/CNS".\n\n' + preview);
    return;
  }
  const headers = rows[headerIdx].map(h => String(h).trim());
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === undefined || c === null)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]).trim() : ''; });
    const cpfcns = obj['CPF/CNS'] || '';
    obj['_cpf_norm'] = normCPF(cpfcns);
    if (!obj['_cpf_norm']) continue;
    data.push(obj);
  }
  rawVinc = buildVincMap(data);
  setStatus('vinc', `✅ ${data.length} cadastros`, nome);
  checkReady();
}

function parseVinc_xlsx(rows, nome) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => String(c).includes('CPF'))) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { alert('Não encontrei coluna "CPF/CNS".'); return; }
  const headers = rows[headerIdx].map(h => String(h).trim());
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === undefined)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]).trim() : ''; });
    const cpfcns = obj['CPF/CNS'] || '';
    obj['_cpf_norm'] = normCPF(cpfcns);
    if (!obj['_cpf_norm']) continue;
    data.push(obj);
  }
  rawVinc = buildVincMap(data);
  setStatus('vinc', `✅ ${data.length} cadastros`, nome);
  checkReady();
}

function buildVincMap(arr) {
  const map = {};
  arr.forEach(r => { if (r['_cpf_norm']) map[r['_cpf_norm']] = r; });
  return map;
}

function setStatus(tipo, msg, nome) {
  const card = document.getElementById('card-' + (tipo === 'siaps' ? 'siaps' : 'vinc'));
  document.getElementById('status-' + tipo).textContent = msg;
  card.classList.add('loaded');
}

function checkReady() {
  document.getElementById('btn-processar').disabled = !(rawSiaps && rawVinc);
}

// ─────────────────────────────────────────────
//  CRUZAMENTO
// ─────────────────────────────────────────────
function processar() {
  merged = rawSiaps.map(s => {
    const v = rawVinc[s['_cpf_norm']] || {};
    const cfg = MODULOS[moduloAtivo];
    const crits = {};
    cfg.criterios.forEach(c => { crits[c.k] = s[c.k] === 'X'; });
    const score  = Object.values(crits).filter(Boolean).length;
    const pontos = cfg.criterios.reduce((soma, c) => soma + (crits[c.k] ? c.pts : 0), 0);
    const situacao = pontos === 100 ? 'completo' : pontos === 0 ? 'pendente' : 'parcial';
    const nascimento = s['Nascimento'] || v['Data de Nascimento'] || v['Data de nascimento'] || '';

    return {
      cpf_orig:    s['CPF'] || s['CNS'] || '',
      cpf_norm:    s['_cpf_norm'],
      nome:        v['Nome']        || '',
      microarea:   v['Microárea']   || '',
      endereco:    v['Endereço']    || '',
      telefone:    v['Telefone celular'] || v['Telefone residencial'] || '',
      nascimento,
      idade:       calcIdade(nascimento),
      sexo:        s['Sexo']        || '',
      cnes:        s['CNES']        || '',
      ine:         s['INE']         || '',
      ...crits,
      NM: s['NM'] === 'X',
      DN: s['DN'] === 'X',
      score, pontos, situacao,
      sem_cadastro: !v['Nome'],
    };
  });

  // Preencher microáreas
  const areas = [...new Set(merged.map(r => r.microarea).filter(Boolean))].sort();
  const sel = document.getElementById('fil-microarea');
  sel.innerHTML = '<option value="">Todas as microáreas</option>';
  areas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = 'Microárea ' + a;
    sel.appendChild(opt);
  });

  atualizarStats();

  document.getElementById('sidebar-stats').style.display  = '';
  document.getElementById('sidebar-filtros').style.display = '';
  document.getElementById('btn-exportar').disabled  = false;
  document.getElementById('btn-imprimir').disabled  = false;

  // Alerta
  const sem = merged.filter(r => r.sem_cadastro).length;
  const alertArea = document.getElementById('alert-area');
  alertArea.innerHTML = sem > 0
    ? `<div class="alert-bar warn" onclick="aplicarFiltroRapido('sem')">
        ⚠️ <strong>${sem} cidadão(s)</strong> não vinculados à ESF no PEC local — clique para filtrar.
       </div>`
    : '';

  filtrar();
}

function atualizarStats() {
  const total    = merged.length;
  const completo = merged.filter(r => r.pontos === 100).length;
  const pend     = merged.filter(r => r.pontos === 0).length;
  const sem      = merged.filter(r => r.sem_cadastro).length;

  document.getElementById('st-total').textContent    = total;
  document.getElementById('st-total-sub').textContent = 'elegíveis';
  document.getElementById('st-ok').textContent       = completo;
  document.getElementById('st-ok-sub').textContent   = pct(completo,total) + '% do total';
  document.getElementById('st-pend').textContent     = pend;
  document.getElementById('st-pend-sub').textContent = pct(pend,total) + '% do total';
  document.getElementById('st-sem').textContent      = sem;
  document.getElementById('st-sem-sub').textContent  = pct(sem,total) + '% do total';
}

function pct(a, b) { return b ? Math.round(a/b*100) : 0; }

// ─────────────────────────────────────────────
//  FILTROS + SORT + PAGINAÇÃO
// ─────────────────────────────────────────────
function aplicarFiltroRapido(val) {
  document.getElementById('fil-situacao').value = val;
  document.getElementById('fil-criterio').value = '';
  document.getElementById('fil-microarea').value = '';
  document.getElementById('busca').value = '';
  // Destacar card ativo
  document.querySelectorAll('.stat-mini').forEach(el => el.classList.remove('active-filter'));
  const map = {'':'cor-total','sem':'cor-sem','completo':'cor-ok','pendente':'cor-pend'};
  if (map[val]) {
    document.querySelector('.stat-mini.' + map[val])?.classList.add('active-filter');
  }
  filtrar();
}

function filtrar() {
  const busca    = document.getElementById('busca').value.toLowerCase().trim();
  const situacao = document.getElementById('fil-situacao').value;
  const criterio = document.getElementById('fil-criterio').value;
  const microarea= document.getElementById('fil-microarea').value;

  filtered = merged.filter(r => {
    if (busca && !r.nome.toLowerCase().includes(busca) && !r.cpf_orig.includes(busca)) return false;
    if (situacao === 'completo' && r.situacao !== 'completo') return false;
    if (situacao === 'parcial'  && r.situacao !== 'parcial')  return false;
    if (situacao === 'pendente' && r.situacao !== 'pendente') return false;
    if (situacao === 'sem'      && !r.sem_cadastro)           return false;
    if (criterio && r[criterio] !== false) return false;
    if (microarea && r.microarea !== microarea) return false;
    return true;
  });

  document.getElementById('count-label').textContent =
    `${filtered.length} de ${merged.length} registros`;

  sortData(); page = 0; renderTable();
}

function sortData() {
  if (!sortCol) return;
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (typeof va === 'boolean') va = va ? 1 : 0;
    if (typeof vb === 'boolean') vb = vb ? 1 : 0;
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ?  1 : -1;
    return 0;
  });
}

function setSort(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  sortData(); page = 0; renderTable();
}

// ─────────────────────────────────────────────
//  RENDER TABELA
// ─────────────────────────────────────────────
function renderTable() {
  const printAll = window._printAll;
  const start = printAll ? 0 : page * PAGE_SIZE;
  const end   = printAll ? filtered.length : start + PAGE_SIZE;
  const slice = filtered.slice(start, end);

  if (filtered.length === 0) {
    document.getElementById('table-container').innerHTML =
      `<div class="empty-state">
        <div class="icon">🔍</div>
        <h3>Nenhum registro encontrado</h3>
        <p>Ajuste os filtros na barra lateral ou limpe a busca.</p>
       </div>`;
    return;
  }

  const arr = col => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  const cfgR = MODULOS[moduloAtivo];
  const critHeaders = cfgR.colsCrit.map(k =>
    `<th title="${cfgR.criterios.find(c=>c.k===k)?.desc||k}" class="sortable" onclick="setSort('${k}')">${k}${arr(k)}</th>`
  ).join('');

  let html = `<div class="table-scroll"><table>
  <thead><tr>
    <th class="sortable" onclick="setSort('nome')" style="min-width:320px;width:35%">Nome${arr('nome')}</th>
    <th class="sortable" onclick="setSort('cpf_orig')" style="min-width:90px;max-width:110px">CPF${arr('cpf_orig')}</th>
    <th class="sortable" onclick="setSort('microarea')">Microárea${arr('microarea')}</th>
    <th class="col-telefone">Telefone</th>
    <th class="sortable" onclick="setSort('nascimento')">Nascimento${arr('nascimento')}</th>
    <th class="sortable" onclick="setSort('idade')" style="min-width:70px">Idade${arr('idade')}</th>
    <th class="sortable" onclick="setSort('pontos')" style="min-width:100px">Pontuação${arr('pontos')}</th>
    ${critHeaders}
    <th class="sortable" onclick="setSort('situacao')" style="min-width:130px">Situação${arr('situacao')}</th>
  </tr></thead><tbody>`;

  slice.forEach(r => {
    const nomeCel = r.nome
      ? `<strong title="${r.nome}">${r.nome}</strong>`
      : `<span class="sem">Cidadão não vinculado à ESF</span>`;

    const ptsClass = r.pontos === 100 ? 'pts-100' : r.pontos === 0 ? 'pts-0' : 'pts-mid';
    const scoreHtml = `<div class="score-bar">
      ${cfgR.colsCrit.map(k =>
        `<div class="pip ${r[k]?'on':'off'}" title="${cfgR.criterios.find(c=>c.k===k)?.desc||k}"></div>`
      ).join('')}
      <span class="score-pts ${ptsClass}">${r.pontos} pts</span>
    </div>`;

    const bc = v => `<span class="badge-crit ${v?'ok':'no'}">${v?'✓':'✗'}</span>`;
    const critCells = cfgR.colsCrit.map(k => `<td class="center">${bc(r[k])}</td>`).join('');

    let tagHtml;
    if (r.sem_cadastro)               tagHtml = `<span class="tag sem">⚠ Não vinculado</span>`;
    else if (r.situacao==='completo') tagHtml = `<span class="tag ok">✅ Completo</span>`;
    else if (r.situacao==='parcial')  tagHtml = `<span class="tag parcial">🔶 ${r.pontos} pts</span>`;
    else                              tagHtml = `<span class="tag pend">❌ Pendente</span>`;

    html += `<tr>
      <td class="nome-cell">${nomeCel}</td>
      <td class="mono">${r.cpf_orig}</td>
      <td class="center">${r.microarea || '—'}</td>
      <td class="col-telefone">${r.telefone || '—'}</td>
      <td>${r.nascimento || '—'}</td>
      <td class="center">${r.idade ?? '—'}</td>
      <td>${scoreHtml}</td>
      ${critCells}
      <td>${tagHtml}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;

  if (!printAll) {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    html += `<div class="pager">
      <span>Página ${page+1} de ${totalPages} · ${filtered.length} registros</span>
      <button onclick="changePage(-1)" ${page===0?'disabled':''}>← Anterior</button>
      <button onclick="changePage(1)"  ${page>=totalPages-1?'disabled':''}>Próxima →</button>
    </div>`;
  }

  document.getElementById('table-container').innerHTML = html;
}

function changePage(dir) { page += dir; renderTable(); }

// ─────────────────────────────────────────────
//  EXPORTAR EXCEL
// ─────────────────────────────────────────────
function exportar() {
  const data = filtered.map(r => ({
    'Nome':              r.nome || '(sem cadastro PEC)',
    'CPF/CNS':           r.cpf_orig,
    'Microárea':         r.microarea,
    'Nascimento':        r.nascimento,
    'Idade':             r.idade ?? '',
    'Sexo':              r.sexo,
    'Telefone':          r.telefone,
    'Endereço':          r.endereco,
    ...Object.fromEntries(
      MODULOS[moduloAtivo].colsCrit.map(k => {
        const c = MODULOS[moduloAtivo].criterios.find(c=>c.k===k);
        return [`${k} (${c?.pts||0}pts) – ${(c?.desc||k).substring(0,30)}`, r[k] ? 'X' : ''];
      })
    ),
    'Pontos (0-100)':    r.pontos,
    'Situação':          r.situacao === 'completo' ? 'Completo' : r.situacao === 'parcial' ? 'Parcial' : 'Pendente',
    'Não vinculado à ESF': r.sem_cadastro ? 'Sim' : 'Não',
    'No denominador':    r.DN ? 'Sim' : 'Não',
    'CNES':              r.cnes,
    'INE':               r.ine,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  const nomesAba = { c6: 'C6 – Pessoa Idosa', c2: 'C2 – Desenv. Infantil', c5: 'C5 – Hipertensão', c4: 'C4 – Diabetes' };
  const nomesArq = { c6: 'c6_pessoa_idosa', c2: 'c2_desenvolvimento_infantil', c5: 'c5_hipertensao', c4: 'c4_diabetes' };
  const nomeAba = nomesAba[moduloAtivo] || moduloAtivo;
  const nomeArq = nomesArq[moduloAtivo] || moduloAtivo;
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  ws['!cols'] = [{wch:32},{wch:18},{wch:12},{wch:12},{wch:8},{wch:8},{wch:18},{wch:40},
    {wch:14},{wch:18},{wch:16},{wch:14},{wch:14},{wch:12},{wch:16},{wch:14},{wch:10},{wch:12}];
  XLSX.writeFile(wb, `${nomeArq}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─────────────────────────────────────────────
//  LIMPAR
// ─────────────────────────────────────────────
function limpar() {
  rawSiaps = rawVinc = null;
  merged = filtered = [];
  ['siaps','vinc'].forEach(t => {
    document.getElementById('status-'+t).textContent = '';
    document.getElementById('card-'+t).classList.remove('loaded','dragover');
  });
  document.getElementById('sidebar-stats').style.display   = 'none';
  document.getElementById('sidebar-filtros').style.display = 'none';
  document.getElementById('btn-processar').disabled = true;
  document.getElementById('btn-exportar').disabled  = true;
  document.getElementById('btn-imprimir').disabled  = true;
  document.getElementById('alert-area').innerHTML   = '';
  document.getElementById('busca').value            = '';
  document.getElementById('fil-situacao').value     = '';
  document.getElementById('fil-criterio').value     = '';
  document.getElementById('fil-microarea').innerHTML = '<option value="">Todas as microáreas</option>';
  document.getElementById('count-label').textContent = '';
  document.getElementById('table-container').innerHTML =
    `<div class="empty-state">
      <div class="icon">📋</div>
      <h3>Nenhum dado carregado</h3>
      <p>Faça o upload do SIAPS e dos Cidadãos Vinculados na barra lateral e clique em "Cruzar dados".</p>
     </div>`;
  sortCol = null; sortAsc = true; page = 0;
}

// ─────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────
renderDashboard();
initAuth();
