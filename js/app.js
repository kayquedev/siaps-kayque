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

  document.getElementById('legenda-criterios').innerHTML = cfg.criterios.map(c =>
    `<div style="display:flex;align-items:flex-start;gap:8px">
      <span style="font-size:11px;font-weight:800;color:var(--azul);min-width:16px">${c.k}</span>
      <span style="font-size:11px;color:var(--muted)">${c.desc} <strong>(${c.pts} pts)</strong></span>
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
  const rows = rawSiapsPorModulo[id] || [];
  const fonte = document.getElementById('fonte-dados');
  if (fonte) {
    fonte.innerHTML =
      `<div class="fonte-item"><strong>${rows.length}</strong> registros no SIAPS</div>
       <div class="fonte-item"><strong>${Object.keys(rawVinc || {}).length}</strong> cadastros vinculados</div>`;
  }

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

  document.getElementById('sidebar-stats').style.display   = '';
  document.getElementById('sidebar-filtros').style.display = '';
  document.getElementById('btn-exportar').disabled = false;
  document.getElementById('btn-imprimir').disabled = false;

  const sem = merged.filter(r => r.sem_cadastro).length;
  const alertArea = document.getElementById('alert-area');
  alertArea.innerHTML = sem > 0
    ? `<div class="alert-bar warn" onclick="aplicarFiltroRapido('sem')">
        ⚠️ <strong>${sem} cidadão(s)</strong> não vinculados à ESF no PEC local — clique para filtrar.
       </div>`
    : '';

  document.getElementById('busca').value        = '';
  document.getElementById('fil-situacao').value = '';
  document.getElementById('fil-criterio').value = '';
  sortCol = null; sortAsc = true; page = 0;

  filtrar();
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
  merged = []; filtered = [];
  moduloAtivo = null;
}

// ─────────────────────────────────────────────
//  IMPRESSÃO PDF
// ─────────────────────────────────────────────
function imprimirPDF() {
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
  c6: {
    titulo: 'C6 — Cuidado da Pessoa Idosa',
    criterios: [
      { k: 'A', desc: 'Consulta médica ou de enfermagem', pts: 25 },
      { k: 'B', desc: 'Peso e altura (antropometria)', pts: 25 },
      { k: 'C', desc: 'Visita ACS/TACS (intervalo ≥30 dias)', pts: 25 },
      { k: 'D', desc: 'Vacina influenza (campanha vigente)', pts: 25 },
    ],
  },
  c7: {
    titulo: 'C7 — Cuidado da Mulher na Prevenção do Câncer',
    criterios: [
      { k: 'A', desc: 'Rastreamento de câncer do colo do útero (25–64 anos), a cada 36 meses', pts: 20, nmCol: 'NM.A', dnCol: 'DN.A' },
      { k: 'B', desc: 'Vacina HPV (9–14 anos, sexo feminino)', pts: 30, nmCol: 'NM.B', dnCol: 'DN.B' },
      { k: 'C', desc: 'Atenção à saúde sexual e reprodutiva (14–69 anos)', pts: 30, nmCol: 'NM.C', dnCol: 'DN.C' },
      { k: 'D', desc: 'Rastreamento de câncer de mama (50–69 anos), a cada 24 meses', pts: 20, nmCol: 'NM.D', dnCol: 'DN.D' },
    ],
  },
  cvat: {
    titulo: 'CVAT — Vínculo e Acompanhamento Territorial',
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
//  C1, M1, M2 e B1-B6 ainda não têm fonte de dados
//  integrada (dependem de SISAB ou e-SUS) e seguem
//  com valores ilustrativos.
// ─────────────────────────────────────────────
const INDICADORES_MUNICIPAIS = [
  { grupo: 'ESF / eAP', codigo: 'C1', nome: 'Mais Acesso à APS', tipo: 'percentual', valor: 62,
    desc: 'Atendimentos agendados vs. demanda espontânea', moduloId: null },
  { grupo: 'ESF / eAP', codigo: 'C2', nome: 'Desenvolvimento Infantil', tipo: 'score', valor: 74,
    desc: '0–24 meses · 5 boas práticas (20 pts cada)', moduloId: 'c2' },
  { grupo: 'ESF / eAP', codigo: 'C3', nome: 'Gestação e Puerpério', tipo: 'score', valor: 58,
    desc: 'Pré-natal e puerpério · 11 boas práticas', moduloId: 'c3' },
  { grupo: 'ESF / eAP', codigo: 'C4', nome: 'Diabetes', tipo: 'score', valor: 71,
    desc: '6 boas práticas · pontuação variável por critério', moduloId: 'c4' },
  { grupo: 'ESF / eAP', codigo: 'C5', nome: 'Hipertensão', tipo: 'score', valor: 69,
    desc: '4 boas práticas · 25 pts cada', moduloId: 'c5' },
  { grupo: 'ESF / eAP', codigo: 'C6', nome: 'Cuidado da Pessoa Idosa', tipo: 'score', valor: 81,
    desc: '≥60 anos · 4 boas práticas · 25 pts cada', moduloId: 'c6' },
  { grupo: 'ESF / eAP', codigo: 'C7', nome: 'Cuidado da Mulher', tipo: 'score', valor: 55,
    desc: 'Colo do útero, HPV, saúde sexual e mamografia por faixa etária', moduloId: 'c7' },

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

function mediaPontos(id) {
  const dados = resultadosPorModulo[id];
  if (!dados || !dados.length) return null;
  const soma = dados.reduce((s, r) => s + r.pontos, 0);
  return Math.round(soma / dados.length);
}

function renderDashboard() {
  const alvo = document.getElementById('dashboard-municipal');
  if (!alvo) return;

  INDICADORES_MUNICIPAIS.forEach(ind => {
    ind._real = false;
    if (ind.moduloId) {
      const media = mediaPontos(ind.moduloId);
      if (media !== null) { ind._real = true; ind._valorReal = media; }
    }
  });

  const dadosCvat   = resultadosPorModulo.cvat;
  const cvatReal    = !!(dadosCvat && dadosCvat.length);
  const temDadoReal = INDICADORES_MUNICIPAIS.some(i => i._real) || cvatReal;

  const comScore = INDICADORES_MUNICIPAIS.filter(i => i.tipo !== 'media');
  const mediaGeral = Math.round(
    comScore.reduce((s, i) => s + (i._real ? i._valorReal : i.valor), 0) / comScore.length
  );

  let populacaoValor = '34.5<span class="unit">mil</span>';
  let populacaoSub   = 'cadastros ativos no território (estimativa)';
  if (temDadoReal) {
    const cpfsUnicos = new Set();
    Object.values(resultadosPorModulo).forEach(lista => lista.forEach(r => { if (r.cpf_norm) cpfsUnicos.add(r.cpf_norm); }));
    populacaoValor = `${cpfsUnicos.size}`;
    populacaoSub   = 'pessoas únicas nos indicadores importados';
  }

  const competencia = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let html = `
    <div class="dash-disclaimer">
      ⚠️ <span><strong>${temDadoReal ? 'Dados reais das planilhas importadas.' : 'Valores ilustrativos.'}</strong> C2, C3, C4, C5, C6, C7 e CVAT são calculados a partir das listas nominais do SIAPS — clique no card para ver a lista nominal. C1, M1, M2 e B1-B6 ainda dependem de outra fonte (SISAB ou e-SUS) e seguem ilustrativos.</span>
    </div>
    <div class="dash-kpis">
      <div class="kpi-tile">
        <div class="kpi-label">Média geral dos indicadores</div>
        <div class="kpi-value">${mediaGeral}<span class="unit">%</span></div>
        <div class="kpi-sub">15 indicadores acompanhados</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Equipes cadastradas</div>
        <div class="kpi-value">19</div>
        <div class="kpi-sub">12 ESF/eAP · 4 eSB · 3 eMulti</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">População coberta</div>
        <div class="kpi-value">${populacaoValor}</div>
        <div class="kpi-sub">${populacaoSub}</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Competência de referência</div>
        <div class="kpi-value" style="font-size:18px;text-transform:capitalize">${competencia}</div>
      </div>
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
      const valorExibido = ind._real ? ind._valorReal : ind.valor;
      const cls = classificarIndic(ind.tipo, valorExibido);
      const unidade = ind.tipo === 'percentual' ? '%' : ind.tipo === 'score' ? ' pts' : '';
      const pctBarra = ind.tipo === 'media' ? Math.min(100, valorExibido / 5 * 100) : valorExibido;

      let tagClasse = 'breve', tagTexto = 'Em breve', clicavel = false, onclick = '', rodape = '';
      if (ind._real) {
        tagClasse = 'ativo'; tagTexto = 'Dado real'; clicavel = true;
        onclick = ` onclick="abrirModulo('${ind.moduloId}')"`;
        rodape = `<div class="indic-link">Acessar lista nominal →</div>`;
      } else if (ind.moduloId) {
        tagClasse = 'pendente'; tagTexto = 'Não importado'; clicavel = true;
        onclick = ` onclick="irParaUpload()"`;
        rodape = `<div class="indic-link">Importar planilha →</div>`;
      }

      html += `<div class="indic-card${clicavel ? ' clickable' : ''}"${onclick} title="${ind.desc}">
        <div class="indic-card-top">
          <span class="indic-code">${ind.codigo}</span>
          <span class="indic-tag ${tagClasse}">${tagTexto}</span>
        </div>
        <div class="indic-value ${cls}"><span class="num">${valorExibido}</span><span class="unit">${unidade}</span></div>
        <div class="indic-name">${ind.nome}</div>
        <div class="indic-desc">${ind.desc}</div>
        <div class="indic-bar"><div class="indic-bar-fill ${cls}" style="width:${pctBarra}%"></div></div>
        ${rodape}
      </div>`;
    });

    html += `</div></div>`;
  });

  // CVAT — card em destaque, com escala 0-10
  let cvatPontuacao = CVAT_EXEMPLO.pontuacao, cvatMax = CVAT_EXEMPLO.max, cvatDims = CVAT_EXEMPLO.dimensoes;
  if (cvatReal) {
    const n = dadosCvat.length;
    const mediaCadastro = dadosCvat.reduce((s, r) => s + r.cadastroPts, 0) / n;
    const mediaAcompanhamento = dadosCvat.reduce((s, r) => s + r.acompanhamentoPts, 0) / n;
    cvatPontuacao = Math.round((mediaCadastro + mediaAcompanhamento) * 10) / 10;
    cvatDims = [
      { label: 'Cadastro (30%)', pts: Math.round(mediaCadastro * 10) / 10, max: 3 },
      { label: 'Acompanhamento territorial (70%)', pts: Math.round(mediaAcompanhamento * 10) / 10, max: 7 },
    ];
  }

  html += `<div class="dash-group">
    <div class="dash-group-header">
      <h3>Vínculo e Acompanhamento Territorial (CVAT)</h3>
      <span>escore 0–10 · ${cvatReal ? 'dado real' : 'exemplo'}</span>
    </div>
    <div class="cvat-card${cvatReal ? ' clickable' : ''}"${cvatReal ? ` onclick="abrirModulo('cvat')"` : ''} title="Cadastro: FCI e ficha de domicílio atualizadas em 24 meses. Acompanhamento: 2+ contatos em 12 meses.">
      <div class="cvat-score">
        <div class="num">${cvatPontuacao}</div>
        <div class="max">de ${cvatMax}</div>
      </div>
      <div class="cvat-dims">
        ${cvatDims.map(d => `
          <div class="cvat-dim-row">
            <span class="cvat-dim-label">${d.label}</span>
            <div class="cvat-dim-bar"><div class="cvat-dim-fill" style="width:${d.pts / d.max * 100}%"></div></div>
            <span class="cvat-dim-pts">${d.pts}/${d.max}</span>
          </div>`).join('')}
      </div>
      ${cvatReal ? `<div class="indic-link" style="flex-basis:100%">Acessar lista nominal →</div>` : ''}
    </div>
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
  const card = document.getElementById('card-' + tipo);
  if (card) card.classList.toggle('dragover', enter);
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
    data.push(obj);
  }
  rawSiapsPorModulo[moduloId] = data;
  setStatus(moduloId, `✅ ${data.length} registros`, nome);
  checkReady();
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
  const card   = document.getElementById('card-' + tipo);
  const status = document.getElementById('status-' + tipo);
  if (status) status.textContent = msg;
  if (card) card.classList.add('loaded');
}

function checkReady() {
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = !(rawVinc && Object.keys(rawSiapsPorModulo).length > 0);
}

// ─────────────────────────────────────────────
//  TELA DE IMPORTAÇÃO
// ─────────────────────────────────────────────
function montarTelaUpload() {
  const alvo = document.getElementById('upload-indicadores');
  if (!alvo) return;
  alvo.innerHTML = Object.keys(MODULOS).map(id => `
    <div class="upload-box" id="card-${id}"
         ondragover="ev(event,'${id}',true)" ondragleave="ev(event,'${id}',false)" ondrop="drop(event,'${id}')">
      <input type="file" accept=".xlsx,.xls,.csv" onchange="loadFile(event,'${id}')">
      <h4>${MODULOS[id].titulo}</h4>
      <p>Lista Nominal Qualidade · SIAPS</p>
      <div class="status" id="status-${id}"></div>
    </div>`).join('');

  const cardVinc = document.getElementById('card-vinc');
  if (cardVinc) cardVinc.classList.remove('loaded', 'dragover');
  const statusVinc = document.getElementById('status-vinc');
  if (statusVinc) statusVinc.textContent = '';
  const btn = document.getElementById('btn-importar');
  if (btn) btn.disabled = true;
}

function importarTudo() {
  Object.keys(rawSiapsPorModulo).forEach(id => {
    const cfg  = MODULOS[id];
    const rows = rawSiapsPorModulo[id];
    resultadosPorModulo[id] = rows.map(s => {
      const v = rawVinc[s['_cpf_norm']] || {};
      return processarLinha(id, cfg, s, v);
    });
  });
  document.getElementById('tela-upload').style.display   = 'none';
  document.getElementById('tela-inicial').style.display  = 'flex';
  renderDashboard();
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
  const situacao = pontos === 100 ? 'completo' : pontos === 0 ? 'pendente' : 'parcial';
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
  const situacao = semCriterioElegivel ? 'pendente' : pontos === 100 ? 'completo' : pontos === 0 ? 'pendente' : 'parcial';
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
  const situacao = pontos === 100 ? 'completo' : pontos === 0 ? 'pendente' : 'parcial';

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
    'Situação':          r.situacao === 'completo' ? 'Completo' : r.situacao === 'parcial' ? 'Parcial' : 'Pendente',
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
//  BOOT
// ─────────────────────────────────────────────
initAuth();
