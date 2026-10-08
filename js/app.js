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
    document.getElementById('login-usuario').value = '';
    document.getElementById('login-senha').value   = '';
    irParaUpload();
  } else {
    erro.textContent = 'Usuário ou senha incorretos.';
    document.getElementById('login-senha').value = '';
  }
}

function sair() {
  sessionStorage.removeItem('siaps_auth');
  limparEstadoGlobal();
  document.getElementById('tela-modulo').style.display   = 'none';
  document.getElementById('tela-inicial').style.display  = 'none';
  document.getElementById('tela-upload').style.display   = 'none';
  document.getElementById('login-usuario').value    = '';
  document.getElementById('login-senha').value      = '';
  document.getElementById('login-erro').textContent = '';
  document.getElementById('tela-login').style.display = 'flex';
}

function initAuth() {
  if (sessionStorage.getItem('siaps_auth') === '1') irParaUpload();
}

// ─────────────────────────────────────────────
//  NAVEGAÇÃO ENTRE TELAS
// ─────────────────────────────────────────────
function irParaUpload() {
  document.getElementById('tela-login').style.display   = 'none';
  document.getElementById('tela-inicial').style.display = 'none';
  document.getElementById('tela-modulo').style.display  = 'none';
  document.getElementById('tela-upload').style.display  = 'flex';
  montarTelaUpload();
}

function abrirModulo(id) {
  if (!MODULOS[id] || !resultadosPorModulo[id]) return;
  moduloAtivo = id;
  merged = resultadosPorModulo[id];
  document.getElementById('tela-inicial').style.display = 'none';
  document.getElementById('tela-modulo').style.display  = 'flex';
  configurarModulo(id);
}

function configurarModulo(id) {
  const cfg = MODULOS[id];

  document.getElementById('mod-titulo').textContent = cfg.titulo;
  document.getElementById('mod-subtitulo').textContent = cfg.subtitulo || '';
  document.getElementById('mod-icone').textContent = cfg.icone || '📋';
  atualizarSidebarNav(id);

  // Filtro de condição PEC sempre visível
  const temCond = !!condicoesMapPorModulo[id];

  document.getElementById('legenda-criterios').innerHTML = cfg.criterios.map(c =>
    `<div style="display:flex;align-items:flex-start;gap:8px">
      <span class="legenda-letra" data-tip="${esc(c.desc)}" data-tip-titulo="Critério ${c.k} · ${c.pts} pts"
            style="font-size:11px;font-weight:800;color:var(--azul);min-width:16px">${c.k}</span>
      <span style="font-size:11px;color:var(--muted)">${esc(c.desc)} <strong>(${c.pts} pts)</strong></span>
     </div>`
  ).join('') +
  `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--cinza-borda);font-size:11px;color:var(--muted)">
    Pontuação máxima: <strong>100 pts</strong> · critérios independentes entre si
   </div>`;

  const selCrit = document.getElementById('fil-criterio');
  selCrit.innerHTML = '<option value="">Qualquer critério</option>';
  cfg.criterios.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.k;
    opt.textContent = `${c.k} — ${c.desc.substring(0,35)}`;
    selCrit.appendChild(opt);
  });

  document.getElementById('legenda-titulo').textContent = `Critérios ${id.toUpperCase()}`;

  // Fonte dos dados (substitui o antigo upload dentro do módulo — os
  // arquivos já foram importados na tela anterior)
  renderFonteDados(id);

  // Preencher microáreas (ao abrir o módulo, o filtro parte de "Todas")
  document.getElementById('fil-microarea').value = '';
  preencherMicroareas();

  // Preencher equipes e aplicar filtro obrigatório quando >1 equipe
  preencherEquipes();

  renderModuloCharts();

  document.getElementById('btn-exportar').disabled = false;
  document.getElementById('btn-imprimir').disabled = false;

  document.getElementById('busca').value        = '';
  document.getElementById('fil-situacao').value = '';
  document.getElementById('fil-criterio').value = '';
  sortCol = null; sortAsc = true; page = 0;

  setTab('nominal');
  filtrar();
}

function renderFonteDados(id) {
  const porEquipe = rawSiapsPorModulo[id];
  let totalReg = 0;
  let numEquipes = 0;
  if (porEquipe && !Array.isArray(porEquipe)) {
    for (const rows of Object.values(porEquipe)) { totalReg += rows.length; numEquipes++; }
  } else if (Array.isArray(porEquipe)) {
    totalReg = porEquipe.length; numEquipes = 1;
  }
  const fonte = document.getElementById('fonte-dados');
  if (fonte) {
    let html =
      `<div class="fonte-item"><strong>${totalReg}</strong> registros no SIAPS${numEquipes > 1 ? ` (${numEquipes} equipes)` : ''}</div>
       <div class="fonte-item"><strong>${Object.keys(rawVinc || {}).length}</strong> cadastros vinculados</div>`;
    const condRows = condicoesMapPorModulo[id] ? Object.keys(condicoesMapPorModulo[id]).length : 0;
    if (condRows > 0) {
      html += `<div class="fonte-item"><strong>${condRows}</strong> registros na lista de condições PEC</div>`;
    }
    fonte.innerHTML = html;
  }
}

// Preenche o filtro de microáreas a partir de `merged`, preservando a
// seleção atual quando ela ainda existir (usado também após importar mais
// planilhas sem sair da consulta).
function preencherMicroareas() {
  const sel = document.getElementById('fil-microarea');
  const atual = sel.value;
  // Normaliza microáreas: trim + remove vazios; preserva FA/NI explicitamente
  const areas = [...new Set(
    merged.map(r => (r.microarea || '').trim()).filter(v => v.length > 0)
  )].sort((a, b) => {
    // Ordenação: números primeiro (natural), depois FA/NI por nome
    const aNum = parseInt(a), bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
  sel.innerHTML = '<option value="">Todas as microáreas</option>';
  areas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    // Label amigável para FA/NI
    const label = a === 'FA' ? 'Fora da Área (FA)'
      : a === 'NI' ? 'Não Informada (NI)'
      : 'Microárea ' + a;
    opt.textContent = label;
    sel.appendChild(opt);
  });
  sel.value = areas.includes(atual) ? atual : '';
}

// Popula o select de equipes para o módulo ativo
function preencherEquipes() {
  const sel = document.getElementById('fil-equipe');
  if (!sel) return;
  const equipes = equipesPorModulo[moduloAtivo] || [];
  if (equipes.length <= 1) {
    sel.style.display = 'none';
    sel.innerHTML = '<option value="">Todas as equipes</option>';
    return;
  }
  sel.style.display = '';
  const salvaSelecao = equipeSelecionada[moduloAtivo] || '';
  sel.innerHTML = '<option value="">Selecione a equipe</option><option value="__todas__">Todas as equipes (consolidado)</option>';
  equipes.forEach(ine => {
    const opt = document.createElement('option');
    opt.value = ine;
    opt.textContent = ine === 'sem_ine' ? 'Sem INE identificado' : 'Equipe ' + ine;
    sel.appendChild(opt);
  });
  // Restaura seleção anterior ou deixa em branco (obrigatório)
  if (salvaSelecao && [...sel.options].some(o => o.value === salvaSelecao)) {
    sel.value = salvaSelecao;
  } else {
    sel.value = '';
  }
}

function voltarInicio() {
  document.getElementById('tela-modulo').style.display  = 'none';
  document.getElementById('tela-inicial').style.display = 'flex';
}

function reimportar() {
  limparEstadoGlobal();
  irParaUpload();
}

function limparEstadoGlobal() {
  rawVinc = null;
  rawSiapsPorModulo = {};
  resultadosPorModulo = {};
  rawCondicoesPorTema = {};
  condicoesMapPorModulo = {};
  statusCondicoes = {};
  statusImport = {};
  merged = []; filtered = [];
  moduloAtivo = null;
  importacaoIncremental = false;
  const modal = document.getElementById('modal-importar');
  if (modal) modal.style.display = 'none';
}

// ─────────────────────────────────────────────
//  IMPRESSÃO PDF
// ─────────────────────────────────────────────
function imprimirPDF() {
  const total    = merged.length;
  const completo = merged.filter(r => r.situacao === 'completo').length;
  const pend     = merged.filter(r => r.situacao === 'pendente').length;
  const sem      = merged.filter(r => r.sem_cadastro).length;
  const dt = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('print-titulo').textContent =
    `${MODULOS[moduloAtivo].titulo} · Lista Nominal`;

  const eqSel = document.getElementById('fil-equipe')?.value || '';
  const eqLabel = eqSel && eqSel !== '__todas__' ? ` · Equipe: ${eqSel === 'sem_ine' ? 'Sem INE' : eqSel}` : '';
  document.getElementById('print-subtitulo').textContent =
    `Gerado em ${dt}${eqLabel} · Exibindo ${filtered.length} de ${total} registros`;

  document.getElementById('print-stats').innerHTML =
    `<span>Total: <strong>${total}</strong></span>` +
    `<span>Sem cadastro: <strong>${sem}</strong></span>` +
    `<span>Completos: <strong>${completo} (${pct(completo,total)}%)</strong></span>` +
    `<span>Pendentes: <strong>${pend} (${pct(pend,total)}%)</strong></span>`;

  const cfgP = MODULOS[moduloAtivo];
  document.getElementById('print-legenda').innerHTML = !pdfCriterios ? '' :
    `<table class="print-legenda-tb"><thead><tr><th>Critério</th><th>Descrição</th><th>Pontos</th></tr></thead><tbody>` +
    cfgP.colsCrit.map(k => {
      const c = cfgP.criterios.find(c => c.k === k);
      return c ? `<tr><td class="center"><strong>${k}</strong></td><td>${esc(c.desc)}</td><td class="center">${c.pts}</td></tr>` : '';
    }).join('') +
    `</tbody></table>`;

  const savedPage = page;
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
//  CONFIGURAÇÃO DOS MÓDULOS (indicadores com
//  cálculo real, a partir das listas nominais do SIAPS)
// ─────────────────────────────────────────────
const MODULOS = {
  c2: {
    titulo: 'C2 — Cuidado no Desenvolvimento Infantil',
    icone: '🧒',
    subtitulo: 'Acompanhamento dos indicadores por criança (dados da planilha)',
    criterios: [
      { k: 'A', desc: '1ª consulta médica/enf. até 30 dias de vida', pts: 20 },
      { k: 'B', desc: '9 consultas médicas/enf. até os 2 anos de vida', pts: 20 },
      { k: 'C', desc: '9 registros de peso+altura até os 2 anos de vida', pts: 20 },
      { k: 'D', desc: '2 visitas de ACS/TACS (30 dias e 6 meses)', pts: 20 },
      { k: 'E', desc: 'Vacinas em dia', pts: 20 },
    ],
  },
  c3: {
    titulo: 'C3 — Cuidado na Gestação e Puerpério',
    icone: '🤰',
    subtitulo: 'Acompanhamento dos indicadores por gestante/puérpera (dados da planilha)',
    criterios: [
      { k: 'A', desc: '1ª consulta até a 12ª semana de gestação', pts: 10 },
      { k: 'B', desc: '≥7 consultas médico/enfermeiro na gestação', pts: 9 },
      { k: 'C', desc: '≥7 aferições de pressão arterial na gestação', pts: 9 },
      { k: 'D', desc: '≥7 registros de peso+altura na gestação', pts: 9 },
      { k: 'E', desc: '≥3 visitas de ACS/TACS após a 1ª consulta', pts: 9 },
      { k: 'F', desc: 'Vacina dTpa a partir da 20ª semana', pts: 9 },
      { k: 'G', desc: 'HIV, Sífilis, Hepatite B e C no 1º trimestre', pts: 9 },
      { k: 'H', desc: 'HIV e Sífilis no 3º trimestre', pts: 9 },
      { k: 'I', desc: 'Consulta no puerpério', pts: 9 },
      { k: 'J', desc: 'Visita de ACS/TACS no puerpério', pts: 9 },
      { k: 'K', desc: 'Atividade de saúde bucal na gestação', pts: 9 },
    ],
  },
  c5: {
    titulo: 'C5 — Controle da Hipertensão Arterial',
    icone: '❤️',
    subtitulo: 'Acompanhamento dos indicadores por pessoa com hipertensão (dados da planilha)',
    criterios: [
      { k: 'A', desc: 'Consulta presencial ou remota por médica(o) ou enfermeira(o), nos últimos 6 meses', pts: 25 },
      { k: 'B', desc: 'Aferição de pressão arterial registrada nos últimos 6 meses', pts: 25 },
      { k: 'C', desc: 'Registro simultâneo de peso e altura nos últimos 12 meses', pts: 25 },
      { k: 'D', desc: '2 visitas domiciliares de ACS/TACS (intervalo ≥30 dias) nos últimos 12 meses', pts: 25 },
    ],
  },
  c4: {
    titulo: 'C4 — Controle da Diabetes Mellitus',
    icone: '🩸',
    subtitulo: 'Acompanhamento dos indicadores por pessoa com diabetes (dados da planilha)',
    criterios: [
      { k: 'A', desc: 'Consulta presencial ou remota por médica(o) ou enfermeira(o), nos últimos 6 meses', pts: 20 },
      { k: 'B', desc: 'Aferição de pressão arterial registrada nos últimos 6 meses', pts: 15 },
      { k: 'C', desc: 'Registro de peso e altura nos últimos 12 meses', pts: 15 },
      { k: 'D', desc: '2 visitas domiciliares de ACS/TACS (intervalo ≥30 dias) nos últimos 12 meses', pts: 20 },
      { k: 'E', desc: 'Hemoglobina Glicada solicitada ou avaliada nos últimos 12 meses', pts: 15 },
      { k: 'F', desc: 'Avaliação dos pés realizada nos últimos 12 meses', pts: 15 },
    ],
  },
  c6: {
    titulo: 'C6 — Cuidado da Pessoa Idosa',
    icone: '👴',
    subtitulo: 'Acompanhamento dos indicadores por pessoa idosa (dados da planilha)',
    criterios: [
      { k: 'A', desc: 'Consulta médica ou de enfermagem', pts: 25 },
      { k: 'B', desc: 'Peso e altura (antropometria)', pts: 25 },
      { k: 'C', desc: 'Visita ACS/TACS (intervalo ≥30 dias)', pts: 25 },
      { k: 'D', desc: 'Vacina influenza (campanha vigente)', pts: 25 },
    ],
  },
  c7: {
    titulo: 'C7 — Cuidado da Mulher na Prevenção do Câncer',
    icone: '🎗️',
    subtitulo: 'Acompanhamento dos indicadores por mulher (dados da planilha)',
    criterios: [
      { k: 'A', desc: 'Rastreamento de câncer do colo do útero (25–64 anos), a cada 36 meses', pts: 20, nmCol: 'NM.A', dnCol: 'DN.A' },
      { k: 'B', desc: 'Vacina HPV (9–14 anos, sexo feminino)', pts: 30, nmCol: 'NM.B', dnCol: 'DN.B' },
      { k: 'C', desc: 'Atenção à saúde sexual e reprodutiva (14–69 anos)', pts: 30, nmCol: 'NM.C', dnCol: 'DN.C' },
      { k: 'D', desc: 'Rastreamento de câncer de mama (50–69 anos), a cada 24 meses', pts: 20, nmCol: 'NM.D', dnCol: 'DN.D' },
    ],
  },
  cvat: {
    titulo: 'CVAT — Vínculo e Acompanhamento Territorial',
    icone: '🗺️',
    subtitulo: 'Acompanhamento do vínculo e território por cidadão (dados da planilha)',
    criterios: [
      { k: 'A', desc: 'Cadastro atualizado — FCI + ficha de domicílio (3 pts) ou só FCI (1,5 pt), em 24 meses', pts: 30 },
      { k: 'B', desc: '≥2 contatos em 12 meses (atendimento, atividade coletiva ou visita domiciliar)', pts: 70 },
    ],
  },
};
// colsCrit é derivado automaticamente da lista de critérios de cada módulo
Object.values(MODULOS).forEach(cfg => { cfg.colsCrit = cfg.criterios.map(c => c.k); });

// ─────────────────────────────────────────────
//  CONDIÇÕES DE SAÚDE (e-SUS PEC)
//  Mapeamento entre listas temáticas do PEC e módulos SIAPS
// ─────────────────────────────────────────────
const CONDICOES_PEC = {
  hipertensao:         { label: 'Hipertensão',            moduloId: 'c5', tema: 'Hipertensão' },
  diabetes:            { label: 'Diabetes',               moduloId: 'c4', tema: 'Diabetes' },
  gestacao_puerperio:  { label: 'Gestação e Puerpério',   moduloId: 'c3', tema: 'Gestação e Puerpério' },
  pessoa_idosa:        { label: 'Pessoa Idosa',           moduloId: 'c6', tema: 'Pessoa Idosa' },
  desenvolvimento_inf: { label: 'Desenvolvimento Infantil', moduloId: 'c2', tema: 'Desenvolvimento Infantil' },
  saude_mulher:        { label: 'Saúde da Mulher',        moduloId: 'c7', tema: 'Saúde da Mulher' },
};
// Itens "em breve" — sem moduloId, aparecem desabilitados na tela de upload
const CONDICOES_EM_BREVE = [
  { key: 'lista_geral',  label: 'Lista Geral' },
  { key: 'saude_bucal',  label: 'Saúde Bucal' },
];

// ─────────────────────────────────────────────
//  DASHBOARD GERAL MUNICIPAL
//  Só exibe valor de indicador quando há planilha importada
//  (C2–C7 e CVAT). C1, M1, M2 e B1-B6 ainda não têm fonte de
//  dados integrada (dependem de SISAB ou e-SUS) e aparecem sem
//  valor — nenhum número é inventado.
// ─────────────────────────────────────────────
const INDICADORES_MUNICIPAIS = [
  { grupo: 'ESF / eAP', codigo: 'C1', nome: 'Mais Acesso à APS', tipo: 'percentual',
    desc: 'Atendimentos agendados vs. demanda espontânea', moduloId: null },
  { grupo: 'ESF / eAP', codigo: 'C2', nome: 'Desenvolvimento Infantil', tipo: 'score',
    desc: '0–24 meses · 5 boas práticas (20 pts cada)', moduloId: 'c2' },
  { grupo: 'ESF / eAP', codigo: 'C3', nome: 'Gestação e Puerpério', tipo: 'score',
    desc: 'Pré-natal e puerpério · 11 boas práticas', moduloId: 'c3' },
  { grupo: 'ESF / eAP', codigo: 'C4', nome: 'Diabetes', tipo: 'score',
    desc: '6 boas práticas · pontuação variável por critério', moduloId: 'c4' },
  { grupo: 'ESF / eAP', codigo: 'C5', nome: 'Hipertensão', tipo: 'score',
    desc: '4 boas práticas · 25 pts cada', moduloId: 'c5' },
  { grupo: 'ESF / eAP', codigo: 'C6', nome: 'Cuidado da Pessoa Idosa', tipo: 'score',
    desc: '≥60 anos · 4 boas práticas · 25 pts cada', moduloId: 'c6' },
  { grupo: 'ESF / eAP', codigo: 'C7', nome: 'Cuidado da Mulher', tipo: 'score',
    desc: 'Colo do útero, HPV, saúde sexual e mamografia por faixa etária', moduloId: 'c7' },

  { grupo: 'eMulti', codigo: 'M1', nome: 'Média de Atendimentos pela eMulti', tipo: 'media',
    desc: 'Atendimentos + atividades coletivas por pessoa (janela de 4 meses)', moduloId: null },
  { grupo: 'eMulti', codigo: 'M2', nome: 'Ações Interprofissionais Compartilhadas', tipo: 'percentual',
    desc: 'Ações com 2+ profissionais ou cuidado compartilhado', moduloId: null },

  { grupo: 'Saúde Bucal (eSB)', codigo: 'B1', nome: '1ª Consulta Odontológica Programática', tipo: 'percentual',
    desc: 'Primeira consulta programática por cirurgião-dentista', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B2', nome: 'Tratamento Concluído', tipo: 'percentual',
    desc: 'Dentro da coorte com 1ª consulta programática', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B3', nome: 'Taxa de Exodontia', tipo: 'percentual',
    desc: 'Exodontias sobre o total de procedimentos odontológicos', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B4', nome: 'Escovação Supervisionada', tipo: 'percentual',
    desc: 'Crianças de 6–12 anos em atividade coletiva', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B5', nome: 'Procedimentos Preventivos', tipo: 'percentual',
    desc: 'Preventivos sobre o total de procedimentos individuais', moduloId: null },
  { grupo: 'Saúde Bucal (eSB)', codigo: 'B6', nome: 'TRA/ART', tipo: 'percentual',
    desc: 'Tratamento Restaurador Atraumático sobre procedimentos restauradores', moduloId: null },
];

// ─────────────────────────────────────────────
//  NAVEGAÇÃO LATERAL (compartilhada entre Painel e Módulo)
// ─────────────────────────────────────────────
function renderSidebarNav(ativo) {
  const modulosComDado = Object.keys(MODULOS).filter(id => resultadosPorModulo[id] && resultadosPorModulo[id].length);
  const item = (icone, label, ativoItem, onclick) =>
    `<div class="app-nav-item${ativoItem ? ' active' : ''}" onclick="${onclick}">
      <span class="app-nav-icon">${icone}</span><span>${label}</span>
     </div>`;
  let html = '<div class="app-nav">';
  modulosComDado.forEach(id => {
    html += item(MODULOS[id].icone || '📋', MODULOS[id].titulo.split(' — ')[0], ativo === id, `abrirModulo('${id}')`);
  });
  // abre o modal por cima da tela atual — não descarta nada do que já foi importado
  html += item('⬆️', 'Importar Planilha', false, 'abrirImportacao()');
  html += '</div>';
  return html;
}

function atualizarSidebarNav(ativo) {
  const a = document.getElementById('sidebar-nav-inicial');
  if (a) a.innerHTML = renderSidebarNav(ativo);
  const b = document.getElementById('sidebar-nav-modulo');
  if (b) b.innerHTML = renderSidebarNav(ativo);
}

function classificarIndic(tipo, valor) {
  if (tipo === 'media') return 'neutro';
  if (valor >= 75) return 'bom';
  if (valor >= 50) return 'regular';
  return 'atencao';
}

function mediaPontos(id) {
  const dados = resultadosPorModulo[id];
  if (!dados || !dados.length) return null;
  const soma = dados.reduce((s, r) => s + r.pontos, 0);
  return Math.round(soma / dados.length);
}

// Computa agregados consolidados de todos os módulos para o Panorama Geral
// Pessoas únicas: deduplicação por CPF em todos os indicadores
function computarPanoramaGeral() {
  const cpfsSiaps = new Set();
  const cpfsCompletos = new Set();   // CPFs que completaram 100% em pelo menos um indicador
  const cpfsPendentes = new Set();   // CPFs que NÃO completaram 100% em nenhum indicador onde aparecem
  const cpfsSemCadastro = new Set();
  let condAtiva = 0, condInativa = 0, somenteSiaps = 0, somentePec = 0;
  const critPendentes = {}; // { "A": { count, desc, modulo } }
  const indicadoresPend = []; // [ { nome, pctPendente, total, pend } ]

  // Primeiro passo: coletar todos os CPFs e seus status por módulo
  const cpfStatus = {}; // { cpf: { completo: bool, pendente: bool, semCadastro: bool } }

  Object.keys(resultadosPorModulo).forEach(modId => {
    const rows = resultadosPorModulo[modId];
    if (!rows || !rows.length) return;
    const cfg = MODULOS[modId];
    let modPend = 0;
    rows.forEach(r => {
      const cpf = r.cpf_norm || r._cpf_norm;
      if (cpf) {
        cpfsSiaps.add(cpf);
        if (!cpfStatus[cpf]) cpfStatus[cpf] = { completo: false, pendente: false, semCadastro: false };
        if (r.situacao === 'completo') {
          cpfStatus[cpf].completo = true;
        } else {
          cpfStatus[cpf].pendente = true;
          modPend++;
        }
        if (r.sem_cadastro) {
          cpfStatus[cpf].semCadastro = true;
        }
      }
      if (r.cond_situacao === 'ok') condAtiva++;
      else if (r.cond_situacao === 'inativa') condInativa++;
      else if (r.cond_situacao === 'somente_siaps') somenteSiaps++;
      else if (r.cond_situacao === 'somente_pec') somentePec++;
      // Critérios pendentes
      if (cfg && cfg.criterios) {
        cfg.criterios.forEach(c => {
          if (r[c.k] === false) {
            if (!critPendentes[c.k]) critPendentes[c.k] = { count: 0, desc: c.desc };
            critPendentes[c.k].count++;
          }
        });
      }
    });
    const pctPend = rows.length > 0 ? Math.round(modPend / rows.length * 100) : 0;
    indicadoresPend.push({ nome: cfg ? cfg.titulo.split(' — ')[0] : modId, pctPendente: pctPend, total: rows.length, pend: modPend });
  });

  // Segundo passo: classificar CPFs únicos
  // Uma pessoa é "completa" se completou 100% em pelo menos um indicador
  // Uma pessoa é "pendente" se tem alguma pendência E nunca completou nenhum indicador
  Object.values(cpfStatus).forEach(s => {
    if (s.completo) cpfsCompletos.add(true); // apenas contador via Set size
    if (s.pendente && !s.completo) cpfsPendentes.add(true);
    if (s.semCadastro) cpfsSemCadastro.add(true);
  });

  // Contagem real de pessoas únicas por categoria
  const unicosCompletos = Object.values(cpfStatus).filter(s => s.completo).length;
  const unicosPendentes = Object.values(cpfStatus).filter(s => s.pendente && !s.completo).length;
  const unicosSemCadastro = Object.values(cpfStatus).filter(s => s.semCadastro).length;

  // Top 5 critérios pendentes
  const topCrits = Object.entries(critPendentes)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([k, v]) => ({ label: `${k} — ${v.desc.substring(0, 30)}`, count: v.count }));

  // Indicadores ordenados por % pendente decrescente
  indicadoresPend.sort((a, b) => b.pctPendente - a.pctPendente);

  return {
    vincPEC: Object.keys(rawVinc || {}).length,
    vincSIAPS: cpfsSiaps.size,
    completos: unicosCompletos,
    pendentes: unicosPendentes,
    semCadastro: unicosSemCadastro,
    condAtiva, condInativa, somenteSiaps, somentePec,
    topCrits, indicadoresPend
  };
}

function renderDashboard() {
  const alvo = document.getElementById('dashboard-municipal');
  if (!alvo) return;
  atualizarSidebarNav('inicial');

  const dadosCvat     = resultadosPorModulo.cvat;
  const cvatImportado = !!(dadosCvat && dadosCvat.length);

  // Nenhum número é inventado: o card só mostra valor/barra quando existe
  // planilha importada para aquele indicador.
  let html = `
    <div class="dash-disclaimer info">
      ℹ️ <span><strong>Valores calculados a partir das planilhas importadas.</strong> C2, C3, C4, C5, C6, C7 e CVAT usam as listas nominais do SIAPS — clique no card para ver a lista nominal. C1, M1, M2 e B1-B6 ainda dependem de outra fonte (SISAB ou e-SUS) e não exibem valor.</span>
    </div>`;

  // ── Panorama Geral (acima dos grupos de indicadores) ──
  const pan = computarPanoramaGeral();
  const temDados = pan.vincPEC > 0 || pan.vincSIAPS > 0;
  if (temDados) {
    // Bloco A: Pessoas Únicas (KPI Tiles)
    html += `<div class="dash-group">
      <div class="dash-group-header"><h3>📊 Panorama Geral</h3><span>Dados consolidados</span></div>
      <div class="panorama-section">
        <div class="chart-kpis panorama-kpis">
          <div class="chart-kpi cor-azul"><div class="val">${pan.vincPEC}</div><div class="lbl">Vinculados PEC</div></div>
          <div class="chart-kpi cor-azul"><div class="val">${pan.vincSIAPS}</div><div class="lbl">Vinculados SIAPS</div></div>
          <div class="chart-kpi cor-verde"><div class="val">${pan.completos}</div><div class="lbl">Indicadores Completos</div></div>
          <div class="chart-kpi cor-ambar"><div class="val">${pan.pendentes}</div><div class="lbl">Indicadores Pendentes</div></div>
          <div class="chart-kpi cor-vermelho"><div class="val">${pan.semCadastro}</div><div class="lbl">Não Vinculados ESF</div></div>
        </div>`;

    // Bloco B: Condições de Saúde PEC/SIAPS (Donut)
    const condTotal = pan.condAtiva + pan.condInativa + pan.somenteSiaps + pan.somentePec;
    if (condTotal > 0) {
      const pA = pct(pan.condAtiva, condTotal), pI = pct(pan.condInativa, condTotal);
      const pS = pct(pan.somenteSiaps, condTotal), pP = pct(pan.somentePec, condTotal);
      const gA = pA, gI = pA + pI, gS = pA + pI + pS;
      html += `<div class="panorama-row">
        <div class="chart-card panorama-condicoes">
          <div class="chart-card-title">Condições de Saúde PEC/SIAPS</div>
          <div class="chart-donut-wrap">
            <div class="chart-donut" style="background:conic-gradient(var(--verde) 0% ${gA}%, var(--ambar) ${gA}% ${gI}%, var(--azul) ${gI}% ${gS}%, var(--vermelho) ${gS}% 100%)">
              <div class="chart-donut-center"><span class="num">${condTotal}</span><span class="lbl">Registros</span></div>
            </div>
            <div class="chart-donut-legend">
              <div class="chart-legend-item"><span class="chart-legend-dot cor-ok"></span>Ativa<span class="chart-legend-val">${pan.condAtiva} (${pA}%)</span></div>
              <div class="chart-legend-item"><span class="chart-legend-dot cor-sem"></span>Inativa<span class="chart-legend-val">${pan.condInativa} (${pI}%)</span></div>
              <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--azul)"></span>Somente SIAPS<span class="chart-legend-val">${pan.somenteSiaps} (${pS}%)</span></div>
              <div class="chart-legend-item"><span class="chart-legend-dot cor-pend"></span>Somente PEC<span class="chart-legend-val">${pan.somentePec} (${pP}%)</span></div>
            </div>
          </div>
        </div>`;

      // Bloco C: Principais Critérios Pendentes (Bar Chart)
      if (pan.topCrits.length > 0) {
        const maxCrit = Math.max(...pan.topCrits.map(c => c.count), 1);
        html += `<div class="chart-card panorama-criterios">
          <div class="chart-card-title">Principais Critérios Pendentes</div>
          <div class="chart-bars">
            ${pan.topCrits.map(c => `<div class="chart-bar-row">
              <span class="chart-bar-label" title="${esc(c.label)}">${c.label}</span>
              <div class="chart-bar-track"><div class="chart-bar-fill cor-pendente" style="width:${Math.round(c.count/maxCrit*100)}%"></div></div>
              <span class="chart-bar-value">${c.count}</span>
            </div>`).join('')}
          </div>
        </div>`;
      }
      html += `</div>`; // fecha panorama-row
    }

    // Bloco D: Principais Indicadores Pendentes (Bar Chart)
    if (pan.indicadoresPend.length > 0) {
      html += `<div class="chart-card panorama-indicadores">
        <div class="chart-card-title">Indicadores por Pendência</div>
        <div class="chart-bars">
          ${pan.indicadoresPend.map(ind => `<div class="chart-bar-row">
            <span class="chart-bar-label" title="${esc(ind.nome)}">${ind.nome}</span>
            <div class="chart-bar-track"><div class="chart-bar-fill ${ind.pctPendente > 50 ? 'cor-pendente' : 'cor-completo'}" style="width:${ind.pctPendente}%"></div></div>
            <span class="chart-bar-value">${ind.pctPendente}%</span>
          </div>`).join('')}
        </div>
      </div>`;
    }

    html += `</div></div>`; // fecha panorama-section e dash-group
  }

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
      const valor = ind.moduloId ? mediaPontos(ind.moduloId) : null;

      let tagClasse = 'breve', tagTexto = 'Em breve', clicavel = false, onclick = '';
      let valorHtml = '', barraHtml = '', rodape = '';
      if (valor !== null) {
        const cls = classificarIndic(ind.tipo, valor);
        const unidade = ind.tipo === 'percentual' ? '%' : ind.tipo === 'score' ? ' pts' : '';
        tagClasse = 'ativo'; tagTexto = 'Importado'; clicavel = true;
        onclick = ` onclick="abrirModulo('${ind.moduloId}')"`;
        valorHtml = `<div class="indic-value ${cls}"><span class="num">${valor}</span><span class="unit">${unidade}</span></div>`;
        barraHtml = `<div class="indic-bar"><div class="indic-bar-fill ${cls}" style="width:${valor}%"></div></div>`;
        rodape = `<div class="indic-link">Acessar lista nominal →</div>`;
      } else if (ind.moduloId) {
        tagClasse = 'pendente'; tagTexto = 'Não importado'; clicavel = true;
        onclick = ` onclick="abrirImportacao()"`;
        rodape = `<div class="indic-link">Importar planilha →</div>`;
      }

      // Badge de equipes importadas
      const eqCount = ind.moduloId && equipesPorModulo[ind.moduloId] ? equipesPorModulo[ind.moduloId].length : 0;
      const eqBadge = eqCount > 1 ? `<div style="font-size:10px;color:#60A5FA;margin-top:2px;font-weight:600">📋 ${eqCount} equipes</div>` : '';

      // Indicador visual de cruzamento PEC ativo
      const temCondPEC = ind.moduloId && !!condicoesMapPorModulo[ind.moduloId];
      const condBadge = temCondPEC ? '<div style="font-size:10px;color:#34D399;margin-top:4px;font-weight:600">🔗 Cruzamento PEC ativo</div>' : '';

      html += `<div class="indic-card${clicavel ? ' clickable' : ''}"${onclick} title="${esc(ind.desc)}">
        <div class="indic-card-top">
          <span class="indic-code">${ind.codigo}</span>
          <span class="indic-tag ${tagClasse}">${tagTexto}</span>
        </div>
        ${valorHtml}
        <div class="indic-name">${ind.nome}</div>
        <div class="indic-desc">${ind.desc}</div>
        ${eqBadge}
        ${condBadge}
        ${barraHtml}
        ${rodape}
      </div>`;
    });

    html += `</div></div>`;
  });

  // CVAT — card em destaque, com escala 0-10 (só com planilha importada)
  let cvatCard;
  if (cvatImportado) {
    const n = dadosCvat.length;
    const mediaCadastro = dadosCvat.reduce((s, r) => s + r.cadastroPts, 0) / n;
    const mediaAcompanhamento = dadosCvat.reduce((s, r) => s + r.acompanhamentoPts, 0) / n;
    const cvatPontuacao = Math.round((mediaCadastro + mediaAcompanhamento) * 10) / 10;
    const cvatDims = [
      { label: 'Cadastro (30%)', pts: Math.round(mediaCadastro * 10) / 10, max: 3 },
      { label: 'Acompanhamento territorial (70%)', pts: Math.round(mediaAcompanhamento * 10) / 10, max: 7 },
    ];
    cvatCard = `<div class="cvat-card clickable" onclick="abrirModulo('cvat')" title="Cadastro: FCI e ficha de domicílio atualizadas em 24 meses. Acompanhamento: 2+ contatos em 12 meses.">
      <div class="cvat-score">
        <div class="num">${cvatPontuacao}</div>
        <div class="max">de 10</div>
      </div>
      <div class="cvat-dims">
        ${cvatDims.map(d => `
          <div class="cvat-dim-row">
            <span class="cvat-dim-label">${d.label}</span>
            <div class="cvat-dim-bar"><div class="cvat-dim-fill" style="width:${d.pts / d.max * 100}%"></div></div>
            <span class="cvat-dim-pts">${d.pts}/${d.max}</span>
          </div>`).join('')}
      </div>
      <div class="indic-link" style="flex-basis:100%">Acessar lista nominal →</div>
    </div>`;
  } else {
    cvatCard = `<div class="cvat-card clickable" onclick="abrirImportacao()" title="Cadastro: FCI e ficha de domicílio atualizadas em 24 meses. Acompanhamento: 2+ contatos em 12 meses.">
      <div class="cvat-vazio">Sem planilha importada para o CVAT.<span class="indic-link">Importar planilha →</span></div>
    </div>`;
  }

  html += `<div class="dash-group">
    <div class="dash-group-header">
      <h3>Vínculo e Acompanhamento Territorial (CVAT)</h3>
      <span>escore 0–10${cvatImportado ? ' · importado' : ''}</span>
    </div>
    ${cvatCard}
  </div>`;

  alvo.innerHTML = html;
}

// ─────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────
let moduloAtivo = null;
let rawVinc = null;                 // mapa CPF -> cadastro vinculado (compartilhado, merge aditivo)
let rawSiapsPorModulo = {};         // { c5: { "INE_x": [rows], "INE_y": [rows] }, ... } — multi-equipe
let resultadosPorModulo = {};       // { c5: [merged...], ... } já processado (consolidado ou filtrado)
let rawCondicoesPorTema = {};       // { hipertensao: { "fonte1": [rows], "fonte2": [rows] }, ... } — multi-fonte
let condicoesMapPorModulo = {};     // { c5: { cpf_norm: row, ... }, ... } — merge aditivo por CPF
let statusCondicoes = {};           // { hipertensao: '✅ 120 registros (2 fontes)' }
let equipesPorModulo = {};          // { c5: ["INE_x", "INE_y"], ... } — lista de equipes detectadas
let equipeSelecionada = {};         // { c5: "INE_x", ... } — seleção atual por módulo
let merged   = [];                  // dados do módulo aberto no momento (referência)
let filtered = [];
let sortCol  = null;
let sortAsc  = true;
let page     = 0;
const PAGE_SIZE = 100;

// Estado da importação
let statusImport = {};              // { vinc: '✅ 120 cadastros', siaps: '✅ C5: 2 eq...', ... }
let importacaoIncremental = false;  // true enquanto o modal "Importar planilhas" está aberto
let vincFontesCount = 0;            // contador de arquivos de vinculados importados

// Estado de exibição (só afeta a tela, nunca os dados)
//  • coluna Telefone: oculta por padrão (classe "mostrar-telefone" no <body>)
//  • modo privacidade: troca nome/CPF/nascimento/telefone por máscara (classe "privacidade" no <body>)
let privacidade = false;
try { privacidade = sessionStorage.getItem('siaps_privacidade') === '1'; } catch (e) { /* sessionStorage indisponível */ }

// Escapa texto vindo de planilha antes de injetar em HTML
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
//  NORMALIZAÇÃO DE CPF
// ─────────────────────────────────────────────
// CPF tem 11 dígitos e CNS tem 15 — qualquer outra contagem de dígitos é
// lixo de outra coluna da planilha (célula deslocada, texto solto etc.),
// não documento de pessoa de verdade, então descarta em vez de completar
// com zero à esquerda (o que fabricava CPF/CNS falso a partir de lixo).
function normCPF(v) {
  if (!v && v !== 0) return '';
  const digitos = String(v).replace(/\D/g, '');
  return (digitos.length === 11 || digitos.length === 15) ? digitos : '';
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
  // funciona tanto no card da tela de importação quanto no do modal
  if (e.currentTarget) e.currentTarget.classList.toggle('dragover', enter);
}
function drop(e, tipo) {
  e.preventDefault();
  ev(e, tipo, false);
  const files = e.dataTransfer.files;
  for (let i = 0; i < files.length; i++) {
    parseFile(files[i], tipo);
  }
}
function loadFile(e, tipo) {
  const input = e.target;
  const files = input.files;
  for (let i = 0; i < files.length; i++) {
    parseFile(files[i], tipo);
  }
  input.value = '';   // permite escolher o mesmo arquivo de novo (ex.: depois de corrigi-lo)
}

// ─────────────────────────────────────────────
//  PARSE DE ARQUIVOS
//  tipo === 'vinc'   → Cidadãos Vinculados (merge aditivo)
//  tipo === 'siaps'  → Upload unificado SIAPS (detecção automática)
//  tipo === 'cond_*' → Condições PEC (merge aditivo por tema)
//  tipo === <id>     → Upload direto por card individual (legado/modal)
// ─────────────────────────────────────────────
function parseFile(file, tipo) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (tipo === 'vinc') parseVinc_xlsx(raw, file.name);
      else if (tipo.startsWith('cond_')) parseCondicoesPEC(raw, file.name);
      else parseSiaps(raw, file.name, tipo); // tipo='siaps' → detecção automática dentro de parseSiaps
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
      if (tipo === 'vinc') parseVinc_csv(res.data, file.name);
      else if (tipo.startsWith('cond_')) parseCondicoesPEC(res.data, file.name);
      else parseSiaps(res.data, file.name, tipo);
    };
    reader.readAsArrayBuffer(file);
  }
}

// Detecta automaticamente o módulo SIAPS pela linha acima do cabeçalho
function detectarModuloSIAPS(rows) {
  // Encontra a linha do cabeçalho (contém "CPF")
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].some(c => String(c).trim() === 'CPF')) { headerIdx = i; break; }
  }
  if (headerIdx <= 0) return null; // sem linha anterior para analisar

  // Lê as linhas acima do cabeçalho (até 5 linhas antes) buscando palavras-chave
  const mapa = [
    { chaves: ['hipertensão', 'hipertensao', 'c5'], mod: 'c5' },
    { chaves: ['diabetes', 'c4'], mod: 'c4' },
    { chaves: ['gestação', 'gestacao', 'puerpério', 'puerperio', 'c3'], mod: 'c3' },
    { chaves: ['desenvolvimento infantil', 'criança', 'crianca', 'c2'], mod: 'c2' },
    { chaves: ['pessoa idosa', 'idoso', 'idosa', 'c6'], mod: 'c6' },
    { chaves: ['mulher', 'câncer', 'cancer', 'prevenção', 'prevencao', 'c7'], mod: 'c7' },
    { chaves: ['vínculo', 'vinculo', 'territorial', 'cvat'], mod: 'cvat' },
  ];

  for (let i = Math.max(0, headerIdx - 5); i < headerIdx; i++) {
    if (!rows[i]) continue;
    const texto = rows[i].map(c => String(c).trim()).join(' ').toLowerCase();
    for (const entrada of mapa) {
      if (entrada.chaves.some(k => texto.includes(k))) return entrada.mod;
    }
  }
  return null;
}

// Extrai o INE da equipe da primeira linha válida de dados
function extrairINE(rows, headerIdx) {
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (!rows[i] || rows[i].every(c => c === '' || c === null || c === undefined)) continue;
    const headers = rows[headerIdx].map(h => String(h).trim());
    const ineIdx = headers.indexOf('INE');
    if (ineIdx >= 0 && rows[i][ineIdx]) {
      const ine = String(rows[i][ineIdx]).trim();
      if (ine) return ine;
    }
    break;
  }
  return 'sem_ine';
}

function parseSiaps(rows, nome, moduloId) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => String(c).trim() === 'CPF')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { alert('Arquivo SIAPS: não encontrei linha com "CPF". Verifique o arquivo.'); return; }

  // Se moduloId não foi fornecido (upload unificado), detectar automaticamente
  if (!moduloId || moduloId === 'siaps') {
    moduloId = detectarModuloSIAPS(rows);
    if (!moduloId) {
      alert(`Não foi possível identificar o indicador do arquivo "${nome}".\nVerifique se há uma linha acima do cabeçalho com o nome do indicador (ex: "Hipertensão", "Diabetes").`);
      return;
    }
  }

  // Extrair INE da equipe
  const ine = extrairINE(rows, headerIdx);

  const headers = rows[headerIdx].map(h => String(h).trim());
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]).trim() : ''; });
    if (!obj['CPF'] && !obj['CNS']) continue;
    obj['_cpf_norm'] = normCPF(obj['CPF'] || obj['CNS']);
    if (!obj['_cpf_norm']) continue;
    obj['_ine'] = ine; // marca cada linha com a equipe de origem
    obj['_fonte'] = nome;
    data.push(obj);
  }

  // Armazena por módulo e equipe (multi-fonte)
  if (!rawSiapsPorModulo[moduloId]) rawSiapsPorModulo[moduloId] = {};
  rawSiapsPorModulo[moduloId][ine] = data;

  // Atualiza lista de equipes
  if (!equipesPorModulo[moduloId]) equipesPorModulo[moduloId] = [];
  if (!equipesPorModulo[moduloId].includes(ine)) equipesPorModulo[moduloId].push(ine);

  // Atualiza status unificado
  atualizarStatusSIAPS();
  aoImportar(moduloId);
}

// Atualiza o resumo/status das planilhas SIAPS importadas (upload unificado)
function atualizarStatusSIAPS() {
  const partes = [];
  let totalRegistros = 0;
  for (const modId of Object.keys(rawSiapsPorModulo)) {
    const equipes = rawSiapsPorModulo[modId];
    const eqCount = Object.keys(equipes).length;
    let regCount = 0;
    for (const eqRows of Object.values(equipes)) regCount += eqRows.length;
    totalRegistros += regCount;
    const titulo = MODULOS[modId] ? MODULOS[modId].titulo : modId;
    partes.push(`${titulo}: ${eqCount} eq. (${regCount} reg.)`);
  }
  const resumo = partes.length > 0
    ? `✅ ${partes.join(' · ')}`
    : '';
  // Atualiza tanto a tela principal quanto o modal
  const elStatus = document.getElementById('status-siaps');
  const elResumo = document.getElementById('upload-indicadores-resumo');
  const mElStatus = document.getElementById('m-status-siaps');
  const mElResumo = document.getElementById('modal-upload-indicadores-resumo');
  if (elStatus) elStatus.textContent = resumo;
  if (elResumo) elResumo.textContent = resumo;
  if (mElStatus) mElStatus.textContent = resumo;
  if (mElResumo) mElResumo.textContent = resumo;
  // Marca card como carregado
  const card = document.getElementById('card-siaps-unificado');
  const mCard = document.getElementById('m-card-siaps-unificado');
  if (card && totalRegistros > 0) card.classList.add('loaded');
  if (mCard && totalRegistros > 0) mCard.classList.add('loaded');
  statusImport['siaps'] = resumo;
}

function parseVinc_csv(rows, nome) {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i]) || rows[i].length < 4) continue;
    const normalized = rows[i].map(c => String(c).trim().replace(/['"ï»¿]/g, ''));
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
  // Merge aditivo: adiciona novos CPFs e atualiza existentes
  if (!rawVinc) rawVinc = {};
  data.forEach(r => { if (r['_cpf_norm']) rawVinc[r['_cpf_norm']] = r; });
  vincFontesCount++;
  const totalVinc = Object.keys(rawVinc).length;
  setStatus('vinc', `✅ ${totalVinc} cadastros (${vincFontesCount} arquivo${vincFontesCount > 1 ? 's' : ''})`, nome);
  aoImportar('vinc');
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
  // Merge aditivo: adiciona novos CPFs e atualiza existentes
  if (!rawVinc) rawVinc = {};
  data.forEach(r => { if (r['_cpf_norm']) rawVinc[r['_cpf_norm']] = r; });
  vincFontesCount++;
  const totalVinc = Object.keys(rawVinc).length;
  setStatus('vinc', `✅ ${totalVinc} cadastros (${vincFontesCount} arquivo${vincFontesCount > 1 ? 's' : ''})`, nome);
  aoImportar('vinc');
}

function buildVincMap(arr) {
  const map = {};
  arr.forEach(r => { if (r['_cpf_norm']) map[r['_cpf_norm']] = r; });
  return map;
}

// ─────────────────────────────────────────────
//  PARSER — CONDIÇÕES DE SAÚDE (e-SUS PEC)
//  Formato: CSV com bloco de metadados institucional nas primeiras ~24 linhas,
//  cabeçalho de colunas na linha que contém 'CPF' e 'Nome', dados a partir da seguinte.
//  A condição é identificada pelo metadado "Lista temática" no bloco de cabeçalho.
// ─────────────────────────────────────────────
function parseCondicoesPEC(rows, nomeArquivo) {
  // 1. Detectar condição via metadado "Lista temática"
  let temaDetectado = null;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const linha = Array.isArray(rows[i]) ? rows[i].join(';') : String(rows[i]);
    if (linha.includes('Lista temática')) {
      // Formato: "Lista temática;Hipertensão;..." ou ["Lista temática","Hipertensão",...]
      const partes = Array.isArray(rows[i]) ? rows[i] : linha.split(';');
      for (let p = 0; p < partes.length - 1; p++) {
        if (String(partes[p]).trim().includes('Lista temática')) {
          temaDetectado = String(partes[p + 1]).trim();
          break;
        }
      }
      if (temaDetectado) break;
    }
  }
  if (!temaDetectado) {
    alert('Não encontrei o metadado "Lista temática" no arquivo.\nVerifique se é um export válido de Acompanhamento de Condições de Saúde.');
    return;
  }

  // 2. Mapear tema → chave em CONDICOES_PEC
  const chave = Object.keys(CONDICOES_PEC).find(k =>
    CONDICOES_PEC[k].tema.toLowerCase() === temaDetectado.toLowerCase()
  );
  if (!chave) {
    alert(`Tema "${temaDetectado}" não reconhecido.\nTemas suportados: ${Object.values(CONDICOES_PEC).map(c => c.tema).join(', ')}`);
    return;
  }
  const cfg = CONDICOES_PEC[chave];

  // 3. Localizar linha de cabeçalho (contém 'CPF' e 'Nome')
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const textos = row.map(c => String(c).trim());
    if (textos.includes('CPF') && textos.includes('Nome')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    alert('Não encontrei a linha de cabeçalho (com "CPF" e "Nome") no arquivo de condições.');
    return;
  }

  // 4. Extrair dados
  const headers = rows[headerIdx].map(h => String(h).trim());
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]).trim() : ''; });

    const cpfRaw = obj['CPF'] || obj['CNS'] || '';
    obj['_cpf_norm'] = normCPF(cpfRaw);
    if (!obj['_cpf_norm']) continue;

    // Campos normalizados para uso no merge
    obj['_nome']            = obj['Nome'] || '';
    obj['_nascimento']      = obj['Data de nascimento'] || '';
    obj['_idade']           = parseInt(obj['Idade']) || null;
    obj['_sexo']            = obj['Sexo'] || '';
    obj['_microarea']       = obj['Microárea'] || '';
    obj['_telefone']        = obj['Telefone celular'] || obj['Telefone residencial'] || obj['Telefone de contato'] || '';
    obj['_meses_atend_med'] = parseInt(obj['Meses desde o último atendimento médico']) || 0;
    obj['_dias_atend_med']  = parseInt(obj['Dias desde o último atendimento médico']) || 0;
    obj['_ultima_pa']       = obj['Última medição de pressão arterial'] || '';
    obj['_data_ultima_pa']  = obj['Data da última medição de pressão arterial'] || '';
    obj['_qtd_visitas']     = parseInt(obj['Quantidade de visitas domiciliares']) || 0;
    obj['_qtd_consultas']   = parseInt(obj['Quantidade de consultas']) || 0;
    obj['_incluido_problemas'] = (obj['Incluído na lista de problemas e condições'] || '').trim();

    data.push(obj);
  }

  // 5. Armazenar com merge multi-fonte
  if (!rawCondicoesPorTema[chave]) rawCondicoesPorTema[chave] = {};
  rawCondicoesPorTema[chave][nomeArquivo] = data;

  // 6. Construir mapa CPF→row para o módulo correspondente (merge aditivo)
  const modId = cfg.moduloId;
  if (!condicoesMapPorModulo[modId]) condicoesMapPorModulo[modId] = {};
  data.forEach(r => { condicoesMapPorModulo[modId][r['_cpf_norm']] = r; });

  // 7. Atualizar status UI com contagem de fontes
  const totalRegistros = Object.keys(condicoesMapPorModulo[modId]).length;
  const numFontes = Object.keys(rawCondicoesPorTema[chave]).length;
  statusCondicoes[chave] = `✅ ${totalRegistros} registros (${numFontes} fonte${numFontes > 1 ? 's' : ''})`;
  setStatus('cond_' + chave, `✅ ${data.length} registros`, nomeArquivo);

  aoImportar('cond_' + chave);
}

function setStatus(tipo, msg, nome) {
  statusImport[tipo] = msg;
  // atualiza o card da tela de importação ('card-…') e o do modal ('m-card-…')
  ['', 'm-'].forEach(pref => {
    const card   = document.getElementById(pref + 'card-' + tipo);
    const status = document.getElementById(pref + 'status-' + tipo);
    if (status) status.textContent = msg;
    if (card) card.classList.add('loaded');
  });
}

function checkReady() {
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = !(rawVinc && Object.keys(rawSiapsPorModulo).length > 0);
}

// Chamado quando um arquivo termina de ser lido. Na tela de importação
// inicial só libera o botão "Importar e ver dashboard"; com o modal aberto
// (dashboard/módulo já carregados) processa na hora, sem sair da tela.
function aoImportar(tipo) {
  if (importacaoIncremental) processarImportacaoIncremental(tipo);
  else checkReady();
}

// ─────────────────────────────────────────────
//  TELA DE IMPORTAÇÃO
// ─────────────────────────────────────────────
function htmlUploadBox(prefixo, tipo, titulo, subtitulo, accept) {
  const status = statusImport[tipo] || '';
  return `
    <div class="upload-box${status ? ' loaded' : ''}" id="${prefixo}card-${tipo}"
         ondragover="ev(event,'${tipo}',true)" ondragleave="ev(event,'${tipo}',false)" ondrop="drop(event,'${tipo}')">
      <input type="file" accept="${accept}" multiple onchange="loadFile(event,'${tipo}')">
      <h4>${titulo}</h4>
      <p>${subtitulo}</p>
      <div class="status" id="${prefixo}status-${tipo}">${status}</div>
    </div>`;
}
function HTML_CARDS_CONDICOES(prefixo) {
  const ativos = Object.entries(CONDICOES_PEC).map(([key, cfg]) =>
    htmlUploadBox(prefixo, 'cond_' + key, cfg.label, 'Condições de Saúde · e-SUS PEC', '.csv')
  ).join('');
  const emBreve = CONDICOES_EM_BREVE.map(item => `
    <div class="upload-box upload-box-disabled" id="${prefixo}card-cond_${item.key}">
      <h4>${item.label}</h4>
      <p>Em breve</p>
      <div class="status" id="${prefixo}status-cond_${item.key}"></div>
    </div>`).join('');
  return ativos + emBreve;
}

function montarTelaUpload() {
  // Upload unificado SIAPS — não gera mais cards individuais
  const resumo = document.getElementById('upload-indicadores-resumo');
  if (resumo) resumo.textContent = '';
  const cardSiaps = document.getElementById('card-siaps-unificado');
  if (cardSiaps) cardSiaps.classList.remove('loaded', 'dragover');
  const statusSiaps = document.getElementById('status-siaps');
  if (statusSiaps) statusSiaps.textContent = '';

  const alvoCond = document.getElementById('upload-condicoes');
  if (alvoCond) alvoCond.innerHTML = HTML_CARDS_CONDICOES('');

  const cardVinc = document.getElementById('card-vinc');
  if (cardVinc) cardVinc.classList.remove('loaded', 'dragover');
  const statusVinc = document.getElementById('status-vinc');
  if (statusVinc) statusVinc.textContent = '';
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = true;
}

// Consolida todas as equipes de um módulo em um único array
function consolidarEquipes(moduloId) {
  const porEquipe = rawSiapsPorModulo[moduloId];
  if (!porEquipe) return [];
  if (Array.isArray(porEquipe)) return porEquipe; // compatibilidade legado
  const todos = [];
  for (const rows of Object.values(porEquipe)) {
    for (let i = 0; i < rows.length; i++) todos.push(rows[i]);
  }
  return todos;
}

// Cruza a lista nominal SIAPS de um módulo com os Cidadãos Vinculados
// e enriquece com dados de condições PEC quando disponíveis
function processarModulo(id) {
  const cfg   = MODULOS[id];
  const vinc  = rawVinc || {};
  const condMap = condicoesMapPorModulo[id] || {};
  const todosRows = consolidarEquipes(id);
  return todosRows.map(s => {
    const cpfNorm = s['_cpf_norm'];
    const cond = condMap[cpfNorm] || null;
    return processarLinha(id, cfg, s, vinc[cpfNorm] || {}, cond);
  });
}

// Pessoas com condição ativa no PEC que NÃO constam na lista SIAPS do módulo
function encontrarFaltantesNoSIAPS(moduloId) {
  const condMap = condicoesMapPorModulo[moduloId] || {};
  const todosRows = consolidarEquipes(moduloId);
  const siapsCPFs = new Set(todosRows.map(s => s['_cpf_norm']));
  const vinc = rawVinc || {};
  const faltantes = [];
  Object.values(condMap).forEach(c => {
    if (c._incluido_problemas !== 'Sim') return; // só ativos
    if (siapsCPFs.has(c._cpf_norm)) return;      // já está no SIAPS
    const v = vinc[c._cpf_norm] || {};
    faltantes.push({
      cpf_orig: '', cpf_norm: c._cpf_norm,
      nome: v['Nome'] || c._nome || '',
      microarea: (v['Microárea'] || c._microarea || '').trim(),
      endereco: v['Endereço'] || '',
      telefone: v['Telefone celular'] || v['Telefone residencial'] || c._telefone || '',
      nascimento: c._nascimento || '', idade: c._idade || null,
      sexo: c._sexo || '', cnes: '', ine: '',
      sem_cadastro: !v['Nome'] && !c._nome,
      cond_encontrado: true, cond_ativa: true,
      meses_sem_atendimento: c._meses_atend_med || 0,
      cond_situacao: 'somente_pec',
      situacao: 'somente_pec', pontos: 0, score: 0,
    });
  });
  return faltantes;
}

function importarTudo() {
  Object.keys(rawSiapsPorModulo).forEach(id => {
    resultadosPorModulo[id] = processarModulo(id);
    // Adicionar faltantes no SIAPS quando há dados de condições para este módulo
    if (condicoesMapPorModulo[id]) {
      resultadosPorModulo[id] = resultadosPorModulo[id].concat(encontrarFaltantesNoSIAPS(id));
    }
  });
  document.getElementById('tela-upload').style.display   = 'none';
  document.getElementById('tela-inicial').style.display  = 'flex';
  renderDashboard();
}

// ─────────────────────────────────────────────
//  IMPORTAR MAIS PLANILHAS (modal) — sem sair da consulta atual
//  e sem descartar o que já foi importado
// ─────────────────────────────────────────────
function abrirImportacao() {
  importacaoIncremental = true;
  // Modal usa área unificada SIAPS (definida estaticamente no HTML)
  const mCardSiaps = document.getElementById('m-card-siaps-unificado');
  if (mCardSiaps) mCardSiaps.classList.remove('loaded', 'dragover');
  const mStatusSiaps = document.getElementById('m-status-siaps');
  if (mStatusSiaps) mStatusSiaps.textContent = statusImport['siaps'] || '';
  const mResumo = document.getElementById('modal-upload-indicadores-resumo');
  if (mResumo) mResumo.textContent = statusImport['siaps'] || '';
  // Restaurar status de vinculados no modal
  const mCardVinc = document.getElementById('m-card-vinc');
  const mStatusVinc = document.getElementById('m-status-vinc');
  if (mCardVinc && Object.keys(rawVinc || {}).length > 0) mCardVinc.classList.add('loaded');
  if (mStatusVinc) mStatusVinc.textContent = statusImport['vinc'] || '';
  const alvoCondModal = document.getElementById('modal-upload-condicoes');
  if (alvoCondModal) alvoCondModal.innerHTML = HTML_CARDS_CONDICOES('m-');
  document.getElementById('modal-importar').style.display = 'flex';
}

// Fecha ao clicar no fundo escuro (evento com target = overlay), no × ou em
// "Concluir" (chamados sem evento).
function fecharImportacao(e) {
  if (e && e.target !== e.currentTarget) return;
  importacaoIncremental = false;
  document.getElementById('modal-importar').style.display = 'none';
}

function processarImportacaoIncremental(tipo) {
  if (!rawVinc) return;
  // tipo='siaps' → upload unificado afeta todos os módulos detectados
  // tipo='vinc' → Cidadãos Vinculados muda nome/microárea de todos os módulos
  // tipo='cond_*' → condições PEC afetam módulos com condicoesMapPorModulo
  // tipo=<id> → módulo específico (legado)
  let ids;
  if (tipo === 'siaps') {
    ids = Object.keys(rawSiapsPorModulo);
  } else if (tipo === 'vinc') {
    ids = Object.keys(rawSiapsPorModulo);
  } else if (tipo.startsWith('cond_')) {
    ids = Object.keys(condicoesMapPorModulo);
  } else {
    ids = [tipo];
  }
  ids.forEach(id => {
    resultadosPorModulo[id] = processarModulo(id);
    if (condicoesMapPorModulo[id]) {
      resultadosPorModulo[id] = resultadosPorModulo[id].concat(encontrarFaltantesNoSIAPS(id));
    }
  });

  const noModulo = document.getElementById('tela-modulo').style.display !== 'none';

  renderDashboard();
  atualizarSidebarNav(noModulo ? moduloAtivo : 'inicial');

  // no módulo aberto: atualiza os dados mantendo busca, filtros, ordem e aba
  const condAfetaModulo = tipo.startsWith('cond_') && condicoesMapPorModulo[moduloAtivo];
  const siapsAfetaModulo = tipo === 'siaps' && rawSiapsPorModulo[moduloAtivo];
  if (noModulo && moduloAtivo && (tipo === 'vinc' || tipo === moduloAtivo || condAfetaModulo || siapsAfetaModulo) && resultadosPorModulo[moduloAtivo]) {
    merged = resultadosPorModulo[moduloAtivo];
    renderFonteDados(moduloAtivo);
    preencherMicroareas();
    preencherEquipes();
    renderModuloCharts();
    filtrar();
  }
}

// ─────────────────────────────────────────────
//  CRUZAMENTO — regra padrão (colunas A, B, C... com "X")
// ─────────────────────────────────────────────
function processarLinha(moduloId, cfg, s, v, cond) {
  if (moduloId === 'c7')   return processarLinhaC7(s, v, cond);
  if (moduloId === 'cvat') return processarLinhaCVAT(s, v, cond);
  return processarLinhaPadrao(cfg, s, v, cond);
}

function dadosBase(s, v, cond) {
  const nascimento = s['Nascimento'] || v['Data de Nascimento'] || v['Data de nascimento'] || '';
  // Enriquecimento com dados de condições PEC (opcional)
  const cond_encontrado = !!cond;
  const cond_ativa = cond ? cond._incluido_problemas === 'Sim' : null;
  const meses_sem_atendimento = cond ? (parseInt(cond._meses_atend_med) || 0) : null;
  let cond_situacao = null;
  if (!cond) {
    cond_situacao = 'somente_siaps';
  } else if (cond._incluido_problemas !== 'Sim') {
    cond_situacao = 'inativa';
  } else {
    cond_situacao = 'ok';
  }
  return {
    cpf_orig:  s['CPF'] || s['CNS'] || '',
    cpf_norm:  s['_cpf_norm'],
    nome:      v['Nome']        || '',
    microarea: (v['Microárea'] || '').trim(),
    endereco:  v['Endereço']    || '',
    telefone:  v['Telefone celular'] || v['Telefone residencial'] || '',
    nascimento,
    idade:     calcIdade(nascimento),
    sexo:      s['Sexo']        || '',
    cnes:      s['CNES']        || '',
    ine:       s['INE']         || s['_ine'] || '',
    sem_cadastro: !v['Nome'],
    att_cadastro: v['Data da última atualização cadastral'] || v['Data última atualização cadastral'] || v['Última atualização cadastral'] || '',
    cond_encontrado,
    cond_ativa,
    meses_sem_atendimento,
    cond_situacao,
  };
}

function processarLinhaPadrao(cfg, s, v, cond) {
  const crits = {};
  cfg.criterios.forEach(c => { crits[c.k] = s[c.k] === 'X'; });
  const score  = Object.values(crits).filter(Boolean).length;
  const pontos = cfg.criterios.reduce((soma, c) => soma + (crits[c.k] ? c.pts : 0), 0);
  const situacao = pontos === 100 ? 'completo' : 'pendente';
  return {
    ...dadosBase(s, v, cond),
    ...crits,
    NM: s['NM'] === 'X',
    DN: s['DN'] === 'X',
    score, pontos, situacao,
  };
}

// C7 — cada critério tem numerador/denominador próprios (elegibilidade
// por faixa etária); a pontuação é normalizada só entre os critérios em
// que a pessoa é elegível.
function processarLinhaC7(s, v, cond) {
  const criterios = MODULOS.c7.criterios;
  const crits = {};
  let pontosObtidos = 0, pontosPossiveis = 0;
  criterios.forEach(c => {
    const elegivel = s[c.dnCol] === 'X';
    const atingiu  = s[c.nmCol] === 'X';
    crits[c.k] = elegivel && atingiu;
    if (elegivel) {
      pontosPossiveis += c.pts;
      if (atingiu) pontosObtidos += c.pts;
    }
  });
  const semCriterioElegivel = pontosPossiveis === 0;
  const pontos = semCriterioElegivel ? 0 : Math.round(pontosObtidos / pontosPossiveis * 100);
  const score  = Object.values(crits).filter(Boolean).length;
  const situacao = pontos === 100 ? 'completo' : 'pendente';
  return {
    ...dadosBase(s, v, cond),
    ...crits,
    score, pontos, situacao,
  };
}

// CVAT — Cadastro (até 3 pts) + Acompanhamento (até 7 pts), normalizado
// para a escala de 0-100 usada no resto do sistema.
function processarLinhaCVAT(s, v, cond) {
  const cadastroCompleto = s['Cadastro Individual e Cadastro Domiciliar'] === 'X';
  const cadastroParcial  = s['Cadastro Individual'] === 'X';
  const cadastroPts = cadastroCompleto ? 3 : (cadastroParcial ? 1.5 : 0);

  const acompanhado =
    s['Pessoa acompanhada sem critério de vulnerabilidade'] === 'X' ||
    s['Criança acompanhada'] === 'X' ||
    s['Pessoa Idosa acompanhada'] === 'X';
  const acompanhamentoPts = acompanhado ? 7 : 0;

  const scoreCvat = cadastroPts + acompanhamentoPts;
  const pontos = Math.round(scoreCvat / 10 * 100);
  const situacao = pontos === 100 ? 'completo' : 'pendente';

  const vulneravel =
    s['Beneficiário BPC ou PBF'] === 'X' ||
    s['Criança beneficiária BPC ou PBF'] === 'X' ||
    s['Pessoa Idosa beneficiária BPC ou PBF'] === 'X';

  return {
    ...dadosBase(s, v, cond),
    A: cadastroPts >= 3,
    B: acompanhado,
    cadastroPts, acompanhamentoPts, vulneravel,
    score: (cadastroPts > 0 ? 1 : 0) + (acompanhado ? 1 : 0),
    pontos, situacao,
  };
}

// ─────────────────────────────────────────────
//  CARDS VISUAIS DO MÓDULO (gráficos no topo)
// ─────────────────────────────────────────────
function renderModuloCharts() {
  const alvo = document.getElementById('modulo-charts');
  if (!alvo || !merged.length) { if (alvo) alvo.innerHTML = ''; return; }

  const total = merged.length;
  const completo = merged.filter(r => r.situacao === 'completo').length;
  const pendente = merged.filter(r => r.situacao === 'pendente').length;
  const semCad   = merged.filter(r => r.sem_cadastro).length;

  // Contagens de condição PEC
  const temCond = !!condicoesMapPorModulo[moduloAtivo];
  const somenteSiaps = temCond ? merged.filter(r => r.cond_situacao === 'somente_siaps').length : 0;
  const somentePec   = temCond ? merged.filter(r => r.cond_situacao === 'somente_pec').length : 0;
  const condAtiva    = temCond ? merged.filter(r => r.cond_situacao === 'ok').length : 0;
  const condInativa  = temCond ? merged.filter(r => r.cond_situacao === 'inativa').length : 0;

  let html = '';

  // ── Card 1: KPIs principais ──
  html += `<div class="chart-card">
    <div class="chart-card-title">Resumo Geral</div>
    <div class="chart-kpis">
      <div class="chart-kpi cor-azul"><div class="val">${total}</div><div class="lbl">Total</div></div>
      <div class="chart-kpi cor-verde"><div class="val">${completo}</div><div class="lbl">Completos</div></div>
      <div class="chart-kpi cor-vermelho"><div class="val">${pendente}</div><div class="lbl">Pendentes</div></div>
      <div class="chart-kpi cor-ambar"><div class="val">${semCad}</div><div class="lbl">Não Vinculado ESF</div></div>
    </div>
  </div>`;

  
  // ── Card 2: Condições de Saúde PEC (donut chart) ──
  if (temCond) {
    const condTotal = condAtiva + condInativa + somenteSiaps + somentePec;
    const pAtiva = pct(condAtiva, condTotal);
    const pInativa = pct(condInativa, condTotal);
    const pSiaps = pct(somenteSiaps, condTotal);
    const pPec = pct(somentePec, condTotal);
    // conic-gradient com 4 segmentos
    const gAtiva = pAtiva;
    const gInativa = pAtiva + pInativa;
    const gSiaps = pAtiva + pInativa + pSiaps;
    html += `<div class="chart-card">
      <div class="chart-card-title">Condições de Saúde PEC</div>
      <div class="chart-donut-wrap">
        <div class="chart-donut" style="background:conic-gradient(var(--verde) 0% ${gAtiva}%, var(--ambar) ${gAtiva}% ${gInativa}%, var(--azul) ${gInativa}% ${gSiaps}%, var(--vermelho) ${gSiaps}% 100%)">
          <div class="chart-donut-center"><span class="num">${condTotal}</span><span class="lbl">Registros</span></div>
        </div>
        <div class="chart-donut-legend">
          <div class="chart-legend-item"><span class="chart-legend-dot cor-ok"></span>Ativa<span class="chart-legend-val">${condAtiva} (${pAtiva}%)</span></div>
          <div class="chart-legend-item"><span class="chart-legend-dot cor-sem"></span>Inativa<span class="chart-legend-val">${condInativa} (${pInativa}%)</span></div>
          <div class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--azul)"></span>Somente SIAPS<span class="chart-legend-val">${somenteSiaps} (${pSiaps}%)</span></div>
          <div class="chart-legend-item"><span class="chart-legend-dot cor-pend"></span>Somente PEC<span class="chart-legend-val">${somentePec} (${pPec}%)</span></div>
        </div>
      </div>
    </div>`;
  }

  // ── Card 3: Adesão por Critério (barras horizontais) ──
  const cfgC = MODULOS[moduloAtivo];
  if (cfgC && cfgC.criterios.length) {
    const critRows = cfgC.criterios.map(c => {
      const count = merged.filter(r => r[c.k]).length;
      return { label: `${c.k} — ${c.desc.substring(0, 28)}`, count, pts: c.pts };
    });
    const maxCrit = Math.max(...critRows.map(c => c.count), 1);
    html += `<div class="chart-card">
      <div class="chart-card-title">Adesão por Critério</div>
      <div class="chart-bars">
        ${critRows.map(c => `<div class="chart-bar-row">
          <span class="chart-bar-label" title="${esc(c.label)}">${c.label}</span>
          <div class="chart-bar-track"><div class="chart-bar-fill cor-completo" style="width:${Math.round(c.count/maxCrit*100)}%"></div></div>
          <span class="chart-bar-value">${c.count}/${total}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  alvo.innerHTML = html;
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
  const filCond = document.getElementById('fil-condicao');
  if (filCond) filCond.value = '';
  document.querySelectorAll('.stat-mini').forEach(el => el.classList.remove('active-filter'));
  const map = {'':'cor-total','sem':'cor-sem','completo':'cor-ok','pendente':'cor-pend'};
  if (map[val]) {
    document.querySelector('.stat-mini.' + map[val])?.classList.add('active-filter');
  }
  filtrar();
}

function aplicarFiltroRapidoCondicao(tipo) {
  const filCond = document.getElementById('fil-condicao');
  if (!filCond) return;
  filCond.value = tipo;
  document.getElementById('fil-situacao').value = '';
  document.getElementById('fil-criterio').value = '';
  document.getElementById('fil-microarea').value = '';
  document.getElementById('busca').value = '';
  document.querySelectorAll('.stat-mini').forEach(el => el.classList.remove('active-filter'));
  filtrar();
}

function filtrar() {
  const busca    = document.getElementById('busca').value.toLowerCase().trim();
  const situacao = document.getElementById('fil-situacao').value;
  const criterio = document.getElementById('fil-criterio').value;
  const microarea= document.getElementById('fil-microarea').value;
  const condicao = document.getElementById('fil-condicao')?.value || '';
  const equipe   = document.getElementById('fil-equipe')?.value || '';
  // Salvar seleção de equipe para o módulo ativo
  if (moduloAtivo && equipe) equipeSelecionada[moduloAtivo] = equipe;

  filtered = merged.filter(r => {
    if (busca && !r.nome.toLowerCase().includes(busca) && !r.cpf_orig.includes(busca)) return false;
    if (situacao === 'completo' && r.situacao !== 'completo') return false;
    if (situacao === 'pendente' && r.situacao !== 'pendente') return false;
    if (situacao === 'sem'      && !r.sem_cadastro)           return false;
    if (criterio && r[criterio] !== false) return false;
    if (microarea && r.microarea !== microarea) return false;
    // Filtro de equipe (INE): __todas__ mostra tudo, vazio com >1 equipe bloqueia
    if (equipe && equipe !== '__todas__' && r.ine !== equipe) return false;
    // Filtro de condição PEC
    if (condicao === 'ok' && r.cond_situacao !== 'ok') return false;
    if (condicao === 'inativa' && r.cond_situacao !== 'inativa') return false;
    if (condicao === 'somente_siaps' && r.cond_situacao !== 'somente_siaps') return false;
    if (condicao === 'somente_pec' && r.cond_situacao !== 'somente_pec') return false;
    return true;
  });

  document.getElementById('count-label').textContent =
    `${filtered.length} de ${merged.length} registros`;

  sortData(); page = 0;
  const tabAtivaEl = document.querySelector('.tab-btn.active');
  if (tabAtivaEl && tabAtivaEl.dataset.tab === 'consolidado') renderConsolidado();
  else renderTable();
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
  const critHeaders = cfgR.colsCrit.map(k => {
    const c = cfgR.criterios.find(c => c.k === k);
    return `<th class="sortable" ${tipAttrs(k, c)} onclick="setSort('${k}')">${k}${arr(k)}</th>`;
  }).join('');

  let html = `<div class="table-scroll"><table>
  <thead><tr>
    <th class="sortable" onclick="setSort('nome')" style="min-width:320px;width:35%">Nome${arr('nome')}</th>
    <th class="sortable" onclick="setSort('cpf_orig')" style="min-width:90px;max-width:110px">CPF${arr('cpf_orig')}</th>
    <th class="sortable" onclick="setSort('microarea')">Microárea${arr('microarea')}</th>
    <th class="col-telefone">Telefone</th>
    <th class="sortable" onclick="setSort('nascimento')">Nascimento${arr('nascimento')}</th>
    <th class="sortable" onclick="setSort('idade')" style="min-width:70px">Idade${arr('idade')}</th>
    ${critHeaders}
    <th class="sortable" onclick="setSort('pontos')" style="min-width:90px">Pontuação${arr('pontos')}</th>
    <th class="sortable" onclick="setSort('situacao')" style="min-width:120px">Situação${arr('situacao')}</th>
    ${condicoesMapPorModulo[moduloAtivo] ? '<th style="min-width:100px">PEC</th><th style="min-width:90px">Últ. Atend.</th>' : ''}
    <th style="min-width:100px">Att. Cadastro</th>
  </tr></thead><tbody>`;

  slice.forEach(r => {
    // modo privacidade: nome, CPF, nascimento e telefone viram máscara fixa
    // (não revela nem o tamanho do texto real, e o title também é omitido)
    const nomeCel = r.nome
      ? (privacidade
          ? `<strong class="mascarado">${MASCARAS.nome}</strong>`
          : `<strong title="${esc(r.nome)}">${esc(r.nome)}</strong>`)
      : `<span class="sem">Cidadão não vinculado à ESF</span>`;
    const cpfTxt = privacidade ? MASCARAS.cpf : esc(r.cpf_orig);
    const nascTxt = r.nascimento ? (privacidade ? MASCARAS.nascimento : esc(r.nascimento)) : '—';
    const telTxt = r.telefone ? (privacidade ? MASCARAS.telefone : esc(r.telefone)) : '—';

    const ptsClass = r.pontos === 100 ? 'pts-100' : r.pontos === 0 ? 'pts-0' : 'pts-mid';
    const pontosHtml = `<span class="score-pts ${ptsClass}">${r.pontos} pts</span>`;

    // texto SIM/NÃO colorido (sem ícones, fundo ou borda)
    const bc = v => `<span class="badge-crit ${v?'ok':'no'}">${v?'SIM':'NÃO'}</span>`;
    const critCells = cfgR.colsCrit.map(k => `<td class="center">${bc(r[k])}</td>`).join('');

    const tagHtml = r.situacao === 'completo'
      ? `<span class="tag ok">Completo</span>`
      : `<span class="tag pend">Incompleto</span>`;

    html += `<tr>
      <td class="nome-cell">${nomeCel}</td>
      <td class="mono${privacidade ? ' mascarado' : ''}">${cpfTxt}</td>
      <td class="center">${r.microarea || '—'}</td>
      <td class="col-telefone${privacidade && r.telefone ? ' mascarado' : ''}">${telTxt}</td>
      <td${privacidade && r.nascimento ? ' class="mascarado"' : ''}>${nascTxt}</td>
      <td class="center">${r.idade ?? '—'}</td>
      ${critCells}
      <td class="center">${pontosHtml}</td>
      <td>${tagHtml}</td>
      ${condicoesMapPorModulo[moduloAtivo] ? (() => {
        const pecBadge = r.cond_situacao === 'ok' ? '<span class="badge-cond-ok">Ativa</span>'
          : r.cond_situacao === 'inativa' ? '<span class="badge-cond-inativa">Inativa</span>'
          : r.cond_situacao === 'somente_pec' ? '<span class="badge-cond-faltante">Somente PEC</span>'
          : r.cond_situacao === 'somente_siaps' ? '<span class="badge-cond-nao">Somente SIAPS</span>'
          : '<span class="badge-cond-nao">—</span>';
        const mesesTxt = r.meses_sem_atendimento !== null && r.meses_sem_atendimento !== undefined
          ? (r.meses_sem_atendimento > 6 ? `<span style="color:var(--vermelho)">${r.meses_sem_atendimento}m</span>`
            : r.meses_sem_atendimento > 3 ? `<span style="color:#D97706">${r.meses_sem_atendimento}m</span>`
            : `<span style="color:var(--verde)">${r.meses_sem_atendimento}m</span>`)
          : '—';
        return `<td class="center">${pecBadge}</td><td class="center">${mesesTxt}</td>`;
      })() : ''}
      <td class="center">${r.att_cadastro || '—'}</td>
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
//  ABAS: Relatório Nominal / Relatório Consolidado
// ─────────────────────────────────────────────
function setTab(t) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.getElementById('table-toolbar').style.display        = t === 'nominal' ? '' : 'none';
  document.getElementById('table-container').style.display      = t === 'nominal' ? '' : 'none';
  document.getElementById('consolidado-container').style.display = t === 'consolidado' ? '' : 'none';
  if (t === 'consolidado') renderConsolidado();
}

// Resumo por microárea (ou por equipe quando >1): total, completos/incompletos
// e adesão a cada critério — reflete os mesmos filtros/busca já aplicados na aba nominal.
function renderConsolidado() {
  const cfgR = MODULOS[moduloAtivo];
  const alvo = document.getElementById('consolidado-container');
  if (!cfgR || !alvo) return;

  // Agrupar por equipe quando houver múltiplas equipes e nenhuma equipe específica selecionada
  const eqSel = document.getElementById('fil-equipe')?.value || '';
  const multiEquipe = (equipesPorModulo[moduloAtivo] || []).length > 1;
  const agruparPorEquipe = multiEquipe && (!eqSel || eqSel === '__todas__');
  const chaveLabel = agruparPorEquipe ? 'Equipe' : 'Microárea';

  const grupos = new Map();
  filtered.forEach(r => {
    const key = agruparPorEquipe
      ? (r.ine || 'sem_ine')
      : ((r.microarea || '').trim() || '(sem microárea)');
    if (!grupos.has(key)) grupos.set(key, { total: 0, completo: 0, crits: Object.fromEntries(cfgR.colsCrit.map(k => [k, 0])) });
    const g = grupos.get(key);
    g.total++;
    if (r.situacao === 'completo') g.completo++;
    cfgR.colsCrit.forEach(k => { if (r[k]) g.crits[k]++; });
  });

  if (!grupos.size) {
    alvo.innerHTML = `<div class="empty-state">
      <div class="icon">📊</div>
      <h3>Nenhum registro para consolidar</h3>
      <p>Ajuste os filtros na barra acima ou limpe a busca.</p>
     </div>`;
    return;
  }

  const linhas = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
  const critHeaders = cfgR.colsCrit.map(k => `<th class="center" ${tipAttrs(k, cfgR.criterios.find(c => c.k === k))}>${k}</th>`).join('');

  let totGeral = 0, complGeral = 0, linhasHtml = '';
  linhas.forEach(([key, g]) => {
    totGeral += g.total; complGeral += g.completo;
    const pctCompleto = pct(g.completo, g.total);
    const critCells = cfgR.colsCrit.map(k => `<td class="center">${g.crits[k]}/${g.total}</td>`).join('');
    const tagClasse = pctCompleto >= 75 ? 'ok' : pctCompleto >= 50 ? 'mid' : 'pend';
    const labelChave = agruparPorEquipe
      ? (key === 'sem_ine' ? 'Sem INE identificado' : 'Equipe ' + key)
      : (key === '(sem microárea)' ? key : 'Microárea ' + key);
    linhasHtml += `<tr>
      <td><strong>${labelChave}</strong></td>
      <td class="center">${g.total}</td>
      ${critCells}
      <td class="center">${g.completo}</td>
      <td class="center"><span class="tag ${tagClasse}">${pctCompleto}%</span></td>
      <td class="center">${g.total - g.completo}</td>
    </tr>`;
  });

  alvo.innerHTML = `<div class="table-scroll"><table>
    <thead><tr>
      <th>${chaveLabel}</th>
      <th class="center">Total</th>
      ${critHeaders}
      <th class="center">Completos</th>
      <th class="center">% Completo</th>
      <th class="center">Incompletos</th>
    </tr></thead>
    <tbody>${linhasHtml}</tbody>
    <tfoot><tr style="font-weight:700;background:var(--cinza-bg)">
      <td>Total geral</td>
      <td class="center">${totGeral}</td>
      ${cfgR.colsCrit.map(() => '<td></td>').join('')}
      <td class="center">${complGeral}</td>
      <td class="center">${pct(complGeral, totGeral)}%</td>
      <td class="center">${totGeral - complGeral}</td>
    </tr></tfoot>
  </table></div>`;
}

// ─────────────────────────────────────────────
//  EXPORTAR EXCEL
// ─────────────────────────────────────────────
function exportar() {
  const cfgE = MODULOS[moduloAtivo];
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
      cfgE.colsCrit.map(k => {
        const c = cfgE.criterios.find(c=>c.k===k);
        return [`${k} (${c?.pts||0}pts) – ${(c?.desc||k).substring(0,30)}`, r[k] ? 'X' : ''];
      })
    ),
    'Pontos (0-100)':    r.pontos,
    'Situação':          r.situacao === 'completo' ? 'Completo' : 'Pendente',
    'Não vinculado à ESF': r.sem_cadastro ? 'Sim' : 'Não',
    'CNES':              r.cnes,
    'INE':               r.ine,
    ...(condicoesMapPorModulo[moduloAtivo] ? {
      'Condição no PEC': r.cond_situacao === 'ok' ? 'Ativa'
        : r.cond_situacao === 'inativa' ? 'Inativa'
        : r.cond_situacao === 'somente_pec' ? 'Somente PEC'
        : 'Não encontrada',
      'Meses desde último atendimento': r.meses_sem_atendimento ?? '',
      'Incluído na lista de problemas': r.cond_ativa === true ? 'Sim' : r.cond_ativa === false ? 'Não' : '',
    } : {}),
    'Att. Cadastro': r.att_cadastro || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  const nomesAba = {
    c2: 'C2 – Desenv. Infantil', c3: 'C3 – Gestação e Puerpério', c4: 'C4 – Diabetes',
    c5: 'C5 – Hipertensão', c6: 'C6 – Pessoa Idosa', c7: 'C7 – Cuidado da Mulher', cvat: 'CVAT',
  };
  const nomesArq = {
    c2: 'c2_desenvolvimento_infantil', c3: 'c3_gestacao_puerperio', c4: 'c4_diabetes',
    c5: 'c5_hipertensao', c6: 'c6_pessoa_idosa', c7: 'c7_cuidado_mulher', cvat: 'cvat',
  };
  const nomeAba = nomesAba[moduloAtivo] || moduloAtivo;
  const nomeArq = nomesArq[moduloAtivo] || moduloAtivo;
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  XLSX.writeFile(wb, `${nomeArq}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─────────────────────────────────────────────
//  EXIBIÇÃO: coluna Telefone, modo privacidade e tooltips
//  (só afetam o que aparece na tela — os dados não mudam)
// ─────────────────────────────────────────────
const MASCARAS = {
  nome:       '••••••••••••••',
  cpf:        '•••••••••••',      // 11 posições — cabe na coluna CPF sem ser cortada
  nascimento: '••/••/••••',
  telefone:   '(••) •••••-••••',
};

// Coluna Telefone: oculta por padrão; o botão da toolbar liga/desliga
function toggleTelefone() {
  const ligado = document.body.classList.toggle('mostrar-telefone');
  const btn = document.getElementById('btn-telefone');
  if (btn) btn.setAttribute('aria-pressed', ligado ? 'true' : 'false');
}

// Modo privacidade (olho): mascara nome, CPF, nascimento e telefone na
// tabela — pensado para print de tela e gravação de vídeo. Vale também para
// o PDF gerado enquanto estiver ativo; a exportação Excel não é afetada.
function aplicarPrivacidade() {
  document.body.classList.toggle('privacidade', privacidade);
  const btn = document.getElementById('btn-privacidade');
  if (btn) btn.setAttribute('aria-pressed', privacidade ? 'true' : 'false');
}

// Toggle "Critérios no PDF": quando ativo, a lista de critérios do indicador
// sai ao fim da lista nominal no PDF. Desligado por padrão.
let pdfCriterios = false;
function togglePdfCriterios() {
  pdfCriterios = !pdfCriterios;
  const btn = document.getElementById('btn-pdf-criterios');
  if (btn) btn.setAttribute('aria-pressed', pdfCriterios ? 'true' : 'false');
}

function togglePrivacidade() {
  privacidade = !privacidade;
  try { sessionStorage.setItem('siaps_privacidade', privacidade ? '1' : '0'); } catch (e) { /* ignora */ }
  aplicarPrivacidade();
  if (moduloAtivo) renderTable();
}

// Tooltip dos critérios (A, B, C…): uma única caixa flutuante reaproveitada,
// posicionada por JS para não ser cortada pelo overflow da tabela.
function tipAttrs(k, c) {
  const desc   = c ? c.desc : k;
  const titulo = 'Critério ' + k + (c ? ' · ' + c.pts + ' pts' : '');
  return `data-tip="${esc(desc)}" data-tip-titulo="${esc(titulo)}"`;
}

function initTooltips() {
  const box = document.createElement('div');
  box.id = 'tip-box';
  document.body.appendChild(box);
  let atual = null;

  function esconder() { atual = null; box.classList.remove('visivel'); }

  function mostrar(el) {
    atual = el;
    box.textContent = '';
    if (el.dataset.tipTitulo) {
      const t = document.createElement('strong');
      t.textContent = el.dataset.tipTitulo;
      box.appendChild(t);
    }
    box.appendChild(document.createTextNode(el.dataset.tip));

    box.style.left = '0px'; box.style.top = '0px';
    const r = el.getBoundingClientRect();
    const w = box.offsetWidth, h = box.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    box.style.left = left + 'px';
    box.style.top  = top + 'px';
    box.classList.add('visivel');
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el && el !== atual) mostrar(el);
    else if (!el && atual) esconder();
  });
  document.addEventListener('mouseout', e => {
    if (atual && !atual.contains(e.relatedTarget)) esconder();
  });
  window.addEventListener('scroll', esconder, true);
}

// ─────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && importacaoIncremental) fecharImportacao();
});
aplicarPrivacidade();
initTooltips();
initAuth();
