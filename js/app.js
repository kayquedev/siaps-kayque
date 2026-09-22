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

  atualizarStats();

  document.getElementById('sidebar-stats').style.display   = '';
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
  const rows = rawSiapsPorModulo[id] || [];
  const fonte = document.getElementById('fonte-dados');
  if (fonte) {
    fonte.innerHTML =
      `<div class="fonte-item"><strong>${rows.length}</strong> registros no SIAPS</div>
       <div class="fonte-item"><strong>${Object.keys(rawVinc || {}).length}</strong> cadastros vinculados</div>`;
  }
}

// Preenche o filtro de microáreas a partir de `merged`, preservando a
// seleção atual quando ela ainda existir (usado também após importar mais
// planilhas sem sair da consulta).
function preencherMicroareas() {
  const sel = document.getElementById('fil-microarea');
  const atual = sel.value;
  const areas = [...new Set(merged.map(r => r.microarea).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas as microáreas</option>';
  areas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = 'Microárea ' + a;
    sel.appendChild(opt);
  });
  sel.value = areas.includes(atual) ? atual : '';
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

  document.getElementById('print-subtitulo').textContent =
    `Gerado em ${dt} · Exibindo ${filtered.length} de ${total} registros`;

  document.getElementById('print-stats').innerHTML =
    `<span>Total: <strong>${total}</strong></span>` +
    `<span>Sem cadastro: <strong>${sem}</strong></span>` +
    `<span>Completos: <strong>${completo} (${pct(completo,total)}%)</strong></span>` +
    `<span>Pendentes: <strong>${pend} (${pct(pend,total)}%)</strong></span>`;

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
  html += item('📊', 'Painel de Indicadores', ativo === 'inicial', 'voltarInicio()');
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

      html += `<div class="indic-card${clicavel ? ' clickable' : ''}"${onclick} title="${esc(ind.desc)}">
        <div class="indic-card-top">
          <span class="indic-code">${ind.codigo}</span>
          <span class="indic-tag ${tagClasse}">${tagTexto}</span>
        </div>
        ${valorHtml}
        <div class="indic-name">${ind.nome}</div>
        <div class="indic-desc">${ind.desc}</div>
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
let rawVinc = null;                 // mapa CPF -> cadastro vinculado (compartilhado)
let rawSiapsPorModulo = {};         // { c2: [...], c4: [...], ... }
let resultadosPorModulo = {};       // { c2: [merged...], ... } já processado
let merged   = [];                  // dados do módulo aberto no momento (referência)
let filtered = [];
let sortCol  = null;
let sortAsc  = true;
let page     = 0;
const PAGE_SIZE = 100;

// Estado da importação
let statusImport = {};              // { vinc: '✅ 120 cadastros', c2: '✅ 45 registros', ... } (texto exibido nos cards)
let importacaoIncremental = false;  // true enquanto o modal "Importar planilhas" está aberto

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
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file, tipo);
}
function loadFile(e, tipo) {
  const input = e.target;
  const file = input.files[0];
  if (file) parseFile(file, tipo);
  input.value = '';   // permite escolher o mesmo arquivo de novo (ex.: depois de corrigi-lo)
}

// ─────────────────────────────────────────────
//  PARSE DE ARQUIVOS
//  tipo === 'vinc'  → Cidadãos Vinculados (compartilhado)
//  tipo === <id do módulo>  → Lista Nominal SIAPS daquele indicador
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
      else parseSiaps(raw, file.name, tipo);
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
      else parseSiaps(res.data, file.name, tipo);
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseSiaps(rows, nome, moduloId) {
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
    if (!obj['_cpf_norm']) continue;
    data.push(obj);
  }
  rawSiapsPorModulo[moduloId] = data;
  setStatus(moduloId, `✅ ${data.length} registros`, nome);
  aoImportar(moduloId);
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
  rawVinc = buildVincMap(data);
  setStatus('vinc', `✅ ${data.length} cadastros`, nome);
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
  rawVinc = buildVincMap(data);
  setStatus('vinc', `✅ ${data.length} cadastros`, nome);
  aoImportar('vinc');
}

function buildVincMap(arr) {
  const map = {};
  arr.forEach(r => { if (r['_cpf_norm']) map[r['_cpf_norm']] = r; });
  return map;
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
      <input type="file" accept="${accept}" onchange="loadFile(event,'${tipo}')">
      <h4>${titulo}</h4>
      <p>${subtitulo}</p>
      <div class="status" id="${prefixo}status-${tipo}">${status}</div>
    </div>`;
}
const HTML_CARDS_INDICADORES = prefixo => Object.keys(MODULOS).map(id =>
  htmlUploadBox(prefixo, id, MODULOS[id].titulo, 'Lista Nominal Qualidade · SIAPS', '.xlsx,.xls,.csv')
).join('');

function montarTelaUpload() {
  const alvo = document.getElementById('upload-indicadores');
  if (!alvo) return;
  alvo.innerHTML = HTML_CARDS_INDICADORES('');

  const cardVinc = document.getElementById('card-vinc');
  if (cardVinc) cardVinc.classList.remove('loaded', 'dragover');
  const statusVinc = document.getElementById('status-vinc');
  if (statusVinc) statusVinc.textContent = '';
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = true;
}

// Cruza a lista nominal SIAPS de um módulo com os Cidadãos Vinculados
function processarModulo(id) {
  const cfg   = MODULOS[id];
  const vinc  = rawVinc || {};
  return (rawSiapsPorModulo[id] || []).map(s => processarLinha(id, cfg, s, vinc[s['_cpf_norm']] || {}));
}

function importarTudo() {
  Object.keys(rawSiapsPorModulo).forEach(id => {
    resultadosPorModulo[id] = processarModulo(id);
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
  document.getElementById('modal-upload-vinc').innerHTML =
    htmlUploadBox('m-', 'vinc', 'Cidadãos Vinculados', '.csv ou .xlsx · e-SUS PEC', '.csv,.xlsx');
  document.getElementById('modal-upload-indicadores').innerHTML = HTML_CARDS_INDICADORES('m-');
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
  // trocar os Cidadãos Vinculados muda nome/microárea de todos os módulos
  const ids = tipo === 'vinc' ? Object.keys(rawSiapsPorModulo) : [tipo];
  ids.forEach(id => { resultadosPorModulo[id] = processarModulo(id); });

  const noModulo = document.getElementById('tela-modulo').style.display !== 'none';

  // o painel sempre é refeito (voltarInicio() só exibe a tela, não redesenha);
  // depois a navegação lateral volta a marcar a tela em que o usuário está
  renderDashboard();
  atualizarSidebarNav(noModulo ? moduloAtivo : 'inicial');

  // no módulo aberto: atualiza os dados mantendo busca, filtros, ordem e aba
  if (noModulo && moduloAtivo && (tipo === 'vinc' || tipo === moduloAtivo) && resultadosPorModulo[moduloAtivo]) {
    merged = resultadosPorModulo[moduloAtivo];
    renderFonteDados(moduloAtivo);
    preencherMicroareas();
    atualizarStats();
    filtrar();
  }
}

// ─────────────────────────────────────────────
//  CRUZAMENTO — regra padrão (colunas A, B, C... com "X")
// ─────────────────────────────────────────────
function processarLinha(moduloId, cfg, s, v) {
  if (moduloId === 'c7')   return processarLinhaC7(s, v);
  if (moduloId === 'cvat') return processarLinhaCVAT(s, v);
  return processarLinhaPadrao(cfg, s, v);
}

function dadosBase(s, v) {
  const nascimento = s['Nascimento'] || v['Data de Nascimento'] || v['Data de nascimento'] || '';
  return {
    cpf_orig:  s['CPF'] || s['CNS'] || '',
    cpf_norm:  s['_cpf_norm'],
    nome:      v['Nome']        || '',
    microarea: v['Microárea']   || '',
    endereco:  v['Endereço']    || '',
    telefone:  v['Telefone celular'] || v['Telefone residencial'] || '',
    nascimento,
    idade:     calcIdade(nascimento),
    sexo:      s['Sexo']        || '',
    cnes:      s['CNES']        || '',
    ine:       s['INE']         || '',
    sem_cadastro: !v['Nome'],
  };
}

function processarLinhaPadrao(cfg, s, v) {
  const crits = {};
  cfg.criterios.forEach(c => { crits[c.k] = s[c.k] === 'X'; });
  const score  = Object.values(crits).filter(Boolean).length;
  const pontos = cfg.criterios.reduce((soma, c) => soma + (crits[c.k] ? c.pts : 0), 0);
  const situacao = pontos === 100 ? 'completo' : 'pendente';
  return {
    ...dadosBase(s, v),
    ...crits,
    NM: s['NM'] === 'X',
    DN: s['DN'] === 'X',
    score, pontos, situacao,
  };
}

// C7 — cada critério tem numerador/denominador próprios (elegibilidade
// por faixa etária); a pontuação é normalizada só entre os critérios em
// que a pessoa é elegível.
function processarLinhaC7(s, v) {
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
    ...dadosBase(s, v),
    ...crits,
    score, pontos, situacao,
  };
}

// CVAT — Cadastro (até 3 pts) + Acompanhamento (até 7 pts), normalizado
// para a escala de 0-100 usada no resto do sistema.
function processarLinhaCVAT(s, v) {
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
    ...dadosBase(s, v),
    A: cadastroPts >= 3,
    B: acompanhado,
    cadastroPts, acompanhamentoPts, vulneravel,
    score: (cadastroPts > 0 ? 1 : 0) + (acompanhado ? 1 : 0),
    pontos, situacao,
  };
}

function atualizarStats() {
  const total    = merged.length;
  const completo = merged.filter(r => r.situacao === 'completo').length;
  const pend     = merged.filter(r => r.situacao === 'pendente').length;
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
    if (situacao === 'pendente' && r.situacao !== 'pendente') return false;
    if (situacao === 'sem'      && !r.sem_cadastro)           return false;
    if (criterio && r[criterio] !== false) return false;
    if (microarea && r.microarea !== microarea) return false;
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

    const bc = v => `<span class="badge-crit ${v?'ok':'no'}">${v?'✓':'✗'}</span>`;
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

// Resumo por microárea: total, completos/incompletos e adesão a cada
// critério — reflete os mesmos filtros/busca já aplicados na aba nominal.
function renderConsolidado() {
  const cfgR = MODULOS[moduloAtivo];
  const alvo = document.getElementById('consolidado-container');
  if (!cfgR || !alvo) return;

  const grupos = new Map();
  filtered.forEach(r => {
    const key = r.microarea || '(sem microárea)';
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
    linhasHtml += `<tr>
      <td><strong>${key === '(sem microárea)' ? key : 'Microárea ' + key}</strong></td>
      <td class="center">${g.total}</td>
      ${critCells}
      <td class="center">${g.completo}</td>
      <td class="center"><span class="tag ${tagClasse}">${pctCompleto}%</span></td>
      <td class="center">${g.total - g.completo}</td>
    </tr>`;
  });

  alvo.innerHTML = `<div class="table-scroll"><table>
    <thead><tr>
      <th>Microárea</th>
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
