/* ==========================================================================
   SudokuON! - javinhas.js (a tela e o jogo: tabuleiro, notas, desfazer, dicas, salvamento)
   Regras e solucionador: regras.js, tecnicas.js, gerador.js (sem DOM, testados no Node).
   Geração da grade: gerador-worker.js (fora da tela principal). Textos: textos.js.
   Menu, sons, vibração e estatísticas do menu: on.js.

   Índice
   1. Dados, preferências e salvamento
   2. Geração da partida (Worker)
   3. Tabuleiro (montar e pintar)
   4. Jogadas (números, notas, apagar, desfazer, verificar)
   5. Dicas explicadas
   6. Relógio, pausa, fim da partida e estatísticas
   7. Telas, escolher partida e Como Jogar
   8. Tamanho, teclado e início
   ========================================================================== */
(function () {
  'use strict';

  const SD = window.Sudoku, TX = window.STXT || {};
  const $ = (s) => document.querySelector(s);

  /* ==========================================================================
     1. Dados, preferências e salvamento
     ========================================================================== */
  const LS = { prefs: 'sudokuon.prefs', jogo: 'sudokuon.jogo', stats: 'sudokuon.stats', dias: 'sudokuon.dias', visto: 'sudokuon.visto' };
  const sget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem espaço ou bloqueado */ } };
  const sdel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } };

  const VARS = ['classico', 'x', 'mini6', 'mini4'];
  const niveisDe = (v) => SD.PERFIL[v].niveis;

  const prefs = Object.assign({ v: 'classico', niveis: {}, erros: 'hora', conf: 'sim', igual: 'sim', limpa: 'sim' }, sget(LS.prefs, {}));
  if (VARS.indexOf(prefs.v) < 0) prefs.v = 'classico';
  if (!prefs.niveis || typeof prefs.niveis !== 'object') prefs.niveis = {};
  VARS.forEach((v) => {
    const n = prefs.niveis[v] | 0;
    prefs.niveis[v] = niveisDe(v).indexOf(n) >= 0 ? n : Math.min(2, niveisDe(v)[niveisDe(v).length - 1]);
  });
  if (['hora', 'verificar'].indexOf(prefs.erros) < 0) prefs.erros = 'hora';
  ['conf', 'igual', 'limpa'].forEach((k) => { if (['sim', 'nao'].indexOf(prefs[k]) < 0) prefs[k] = 'sim'; });
  const gravarPrefs = () => sset(LS.prefs, prefs);

  const el = {
    tab: $('#tab'), box: $('#mesa-box'), area: $('#game-area'), tela: $('#tela'), telaTitulo: $('#tela-titulo'), telaCorpo: $('#tela-corpo'),
    telaBtn: $('#tela-btn'), telaBtn2: $('#tela-btn2'), msg: $('#message-area'), acoes: $('#acoes'), entrada: $('#entrada'),
    pad: $('#pad'), ferr: $('#ferramentas'), modoNome: $('#modo-nome'), modoNum: $('#modo-num'), modoMini: $('#modo-mini'),
    v1: $('#hud-v1'), v2: $('#hud-v2'), v3: $('#hud-v3'), tempoBtn: $('#tempo-btn'),
    notas: $('#notas-btn'), apagar: $('#apagar-btn'), desfazer: $('#desfazer-btn'), refazer: $('#refazer-btn'), dica: $('#dica-btn'),
    restart: $('#restart-btn')
  };

  const reduzido = () => !!(window.ON && ON.cfg && ON.cfg.reduzir);
  let msgT = 0;
  function dizer(t, ms) {
    el.msg.textContent = t;
    clearTimeout(msgT);
    if (t) msgT = setTimeout(() => { el.msg.textContent = ''; }, ms || 6000);
  }
  const fmtT = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
  };
  const bit = (d) => 1 << (d - 1);
  const nomeVar = (v) => SD.VARIANTES[v].nome;
  const nomeNivel = (n) => SD.NIVEIS[n];
  const dataBR = (num) => { const s = String(num); return s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4); };
  const sortear = () => 1 + Math.floor(Math.random() * 999999);

  // estado da partida atual (null até a primeira grade ficar pronta)
  let S = null;
  let ocupado = false;     // gerando uma grade: os controles esperam
  let cels = [];           // botões do tabuleiro
  let tabId = '';          // variante que o tabuleiro montado representa
  let padId = '';

  function gravarPartida() {
    if (!S || S.fim) return;
    sset(LS.jogo, {
      f: 1, v: S.v, nivel: S.nivel, nr: S.nivelReal, aprox: S.aprox, num: S.num, dia: S.dia,
      puz: Array.from(S.puz).join(''), sol: Array.from(S.sol).join(''), val: Array.from(S.val).join(''),
      notas: Array.from(S.notas), elim: Array.from(S.elim), acum: Math.floor(S.acum / 1000), erros: S.erros, dicas: S.dicas,
      contados: Array.from(S.contados), sel: S.sel
    });
  }

  function lerPartida() {
    const s = sget(LS.jogo, null);
    if (!s || s.f !== 1 || VARS.indexOf(s.v) < 0) return null;
    try {
      const G = SD.montar(s.v), N = G.N;
      if (typeof s.puz !== 'string' || typeof s.sol !== 'string' || typeof s.val !== 'string') return null;
      if (s.puz.length !== N || s.sol.length !== N || s.val.length !== N) return null;
      if (!Array.isArray(s.notas) || s.notas.length !== N || !Array.isArray(s.elim) || s.elim.length !== N) return null;
      const puz = Int8Array.from(SD.grade(s.puz)), sol = Int8Array.from(SD.grade(s.sol)), val = Int8Array.from(SD.grade(s.val));
      for (let i = 0; i < N; i++) {
        if (puz[i] > G.n || sol[i] < 1 || sol[i] > G.n || val[i] > G.n) return null;
        if (puz[i] && (puz[i] !== sol[i] || val[i] !== puz[i])) return null;
        if (!(s.notas[i] >= 0 && s.notas[i] <= G.cheia) || !(s.elim[i] >= 0 && s.elim[i] <= G.cheia)) return null;
      }
      if (SD.conflitos(G, sol).some((x) => x)) return null;
      return { s, G, puz, sol, val };
    } catch (e) { return null; }
  }

  /* ==========================================================================
     2. Geração da partida (Worker)
     ========================================================================== */
  let worker = null, semWorker = false, seq = 0, geracao = 0;
  const reqs = new Map();

  function matarWorker() {
    const w = worker; worker = null;
    try { if (w) w.terminate(); } catch (e) { /* ignora */ }
    reqs.forEach((r) => r.rej(new Error('cancelado')));
    reqs.clear();
  }
  function ligarWorker() {
    if (worker || semWorker || !window.Worker) return worker;
    try {
      worker = new Worker('gerador-worker.js');
      worker.onmessage = (ev) => {
        const m = ev.data, r = reqs.get(m.id);
        if (!r) return;
        reqs.delete(m.id);
        if (m.erro) r.rej(new Error(m.erro)); else r.res(m.r);
      };
      worker.onerror = () => { semWorker = true; matarWorker(); };
    } catch (e) { worker = null; semWorker = true; }
    return worker;
  }
  function gerarNaTela(v, n, sem) {
    return new Promise((res, rej) => setTimeout(() => { try { res(SD.gerar(v, n, sem)); } catch (e) { rej(e); } }, 40));
  }
  function gerarAsync(v, n, sem) {
    const w = ligarWorker();
    if (!w) return gerarNaTela(v, n, sem);
    return new Promise((res, rej) => {
      const id = ++seq;
      reqs.set(id, { res, rej });
      w.postMessage({ id, variante: v, nivel: n, semente: sem });
    }).catch((e) => (e && e.message === 'cancelado' ? Promise.reject(e) : gerarNaTela(v, n, sem)));
  }

  /* Cria a partida. A tela de "preparando" só aparece se a grade demorar mais que um instante. */
  function iniciar(v, nivel, num) {
    const minha = ++geracao;
    matarWorker();
    ocupado = true;
    const quando = setTimeout(() => {
      if (minha !== geracao) return;
      mostrarTela({
        titulo: 'Preparando a grade',
        corpo: '<p>Procurando uma partida com uma só solução, no nível ' + nomeNivel(nivel) + '. Níveis altos podem levar alguns segundos.</p>',
        opaca: true, btn: S ? 'Cancelar' : null, fn: () => cancelarGeracao()
      });
    }, 220);
    return gerarAsync(v, nivel, SD.semente(v, nivel, num)).then((r) => {
      clearTimeout(quando);
      if (minha !== geracao) return;
      ocupado = false;
      novaPartida(r, num);
    }).catch((e) => {
      clearTimeout(quando);
      if (minha !== geracao) return;
      ocupado = false;
      if (S) { fecharTela(); dizer('Não consegui criar essa grade. Tente outro número.'); }
      else iniciar('classico', 1, sortear());
    });
  }

  function cancelarGeracao() {
    geracao++;
    matarWorker();
    ocupado = false;
    if (S) { fecharTela(); if (S.pausa) telaPausa(); }
    else iniciar('classico', 1, sortear());
  }

  function novaPartida(r, num) {
    const G = SD.montar(r.variante), N = G.N;
    S = {
      v: r.variante, nivel: r.nivel, nivelReal: r.nivelReal, aprox: !!r.aproximado, num, dia: num === SD.numeroDoDia(),
      G, puz: Int8Array.from(SD.grade(r.puzzle)), sol: Int8Array.from(SD.grade(r.solucao)),
      val: Int8Array.from(SD.grade(r.puzzle)), notas: new Int16Array(N), elim: new Int16Array(N), marcas: new Uint8Array(N),
      acum: 0, tempo: 0, erros: 0, dicas: 0, contados: new Set(), sel: -1, modoNotas: false, fim: false, pausa: false,
      hist: [], refaz: [], dica: null
    };
    S.sel = S.puz.findIndex((d) => !d);
    prefs.v = S.v;
    prefs.niveis[S.v] = S.nivel;
    gravarPrefs();
    contar('inicio');
    fecharTela();
    montarTudo();
    gravarPartida();
    dizer('Partida pronta: ' + nomeVar(S.v) + ', ' + nomeNivel(S.nivel) + '.', 4000);
  }

  function restaurar() {
    const L = lerPartida();
    if (!L) { sdel(LS.jogo); return false; }
    const s = L.s, N = L.G.N;
    S = {
      v: s.v, nivel: s.nivel, nivelReal: s.nr || s.nivel, aprox: !!s.aprox, num: s.num, dia: !!s.dia,
      G: L.G, puz: L.puz, sol: L.sol, val: L.val, notas: Int16Array.from(s.notas), elim: Int16Array.from(s.elim), marcas: new Uint8Array(N),
      acum: Math.max(0, +s.acum || 0) * 1000, tempo: Math.max(0, +s.acum || 0), erros: s.erros | 0, dicas: s.dicas | 0,
      contados: new Set(Array.isArray(s.contados) ? s.contados : []), sel: (s.sel >= 0 && s.sel < N) ? s.sel : L.puz.findIndex((d) => !d),
      modoNotas: false, fim: false, pausa: true, hist: [], refaz: [], dica: null
    };
    montarTudo();
    telaPausa(true);
    return true;
  }

  /* ==========================================================================
     3. Tabuleiro (montar e pintar)
     ========================================================================== */
  function montarTudo() {
    montarTab();
    montarPad();
    pintarModo();
    pintar();
    hud();
    ferramentas();
    ajustar();
  }

  function montarTab() {
    const G = S.G;
    if (tabId !== G.id) {
      tabId = G.id;
      el.tab.style.setProperty('--n', G.n);
      el.tab.style.setProperty('--br', G.br);
      el.tab.style.setProperty('--bc', G.bc);
      el.tab.dataset.v = G.id;
      cels = [];
      for (let i = 0; i < G.N; i++) {
        const b = document.createElement('button');
        const r = G.linha(i), c = G.coluna(i);
        b.type = 'button';
        b.dataset.i = i;
        b.tabIndex = -1;
        let base = 'cel';
        if (c % G.bc === G.bc - 1 && c < G.n - 1) base += ' bd';
        if (r % G.br === G.br - 1 && r < G.n - 1) base += ' bb';
        if (c === G.n - 1) base += ' ur';
        if (r === G.n - 1) base += ' ub';
        if (G.diag && (r === c || r + c === G.n - 1)) base += ' diag';
        b._base = base;
        b._cl = null; b._k = null;
        b.style.setProperty('--d', r + c);
        cels.push(b);
      }
      el.tab.replaceChildren(...cels);
    } else {
      cels.forEach((b) => { b._cl = null; b._k = null; });
    }
  }

  function montarPad() {
    const G = S.G;
    if (padId === G.id) return;
    padId = G.id;
    const bts = [];
    for (let d = 1; d <= G.n; d++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pad-btn'; b.dataset.d = d;
      b.innerHTML = '<b>' + d + '</b><small></small>';
      bts.push(b);
    }
    el.pad.replaceChildren(...bts);
  }

  function notasHTML(G, mask, dest, sai) {
    let h = '';
    for (let d = 1; d <= G.n; d++) {
      const on = mask & bit(d);
      const c = (dest & bit(d) ? 'dest ' : '') + (sai & bit(d) ? 'sai' : '');
      h += on ? '<i' + (c ? ' class="' + c.trim() + '"' : '') + '>' + d + '</i>' : '<i></i>';
    }
    return h;
  }

  function pintar() {
    if (!S) return;
    const G = S.G, N = G.N;
    const conf = prefs.conf === 'sim' ? SD.conflitos(G, S.val) : null;
    const rel = new Uint8Array(N);
    let dsel = 0;
    if (S.sel >= 0) { G.vizinhos[S.sel].forEach((j) => { rel[j] = 1; }); dsel = S.val[S.sel]; }
    const hora = prefs.erros === 'hora';
    const dica = S.dica;
    const foco = new Set(), alvo = new Map();
    if (dica) {
      dica.p.celulas.forEach((i) => foco.add(i));
      if (dica.p.colocar) foco.add(dica.p.colocar.i);
      (dica.p.eliminar || []).forEach((e) => { alvo.set(e.i, (alvo.get(e.i) || 0) | bit(e.d)); });
    }
    const mostraCand = dica && dica.etapa === 2 && dica.cand;
    for (let i = 0; i < N; i++) {
      const b = cels[i];
      let cl = b._base;
      if (S.puz[i]) cl += ' dado'; else if (S.val[i]) cl += ' meu';
      if (i === S.sel) cl += ' sel'; else if (rel[i]) cl += ' rel';
      if (prefs.igual === 'sim' && dsel && S.val[i] === dsel && i !== S.sel) cl += ' igual';
      if (conf && conf[i]) cl += ' conf';
      if (S.val[i] && !S.puz[i] && S.val[i] !== S.sol[i] && (hora || S.marcas[i])) cl += ' erro';
      if (foco.has(i)) cl += ' foco'; else if (alvo.has(i)) cl += ' alvo';
      if (b._cl !== cl) { b.className = cl; b._cl = cl; }
      const tabi = i === S.sel ? 0 : -1;
      if (b.tabIndex !== tabi) b.tabIndex = tabi;
      const sobre = mostraCand && !S.val[i] && (foco.has(i) || alvo.has(i));
      const v = S.val[i];
      const mask = v ? 0 : (sobre ? dica.cand[i] : S.notas[i]);
      const dest = sobre && dica.p.digitos ? dica.p.digitos.reduce((a, d) => a | bit(d), 0) : 0;
      const sai = sobre ? (alvo.get(i) || 0) : 0;
      const k = v + '|' + mask + '|' + (sobre ? 1 : 0) + '|' + dest + '|' + sai + '|' + (b._cl.indexOf(' sel') >= 0 ? 1 : 0);
      if (b._k !== k) {
        b._k = k;
        if (v) b.innerHTML = '<span class="v">' + v + '</span>';
        else if (mask) b.innerHTML = '<span class="nt' + (sobre ? ' sobre' : '') + '">' + notasHTML(G, mask, dest, sai) + '</span>';
        else b.textContent = '';
        let rot = 'Linha ' + (G.linha(i) + 1) + ', coluna ' + (G.coluna(i) + 1) + ', ';
        if (v) rot += (S.puz[i] ? 'número ' + v + ' da grade' : 'número ' + v);
        else if (mask) rot += 'vazia, notas ' + SD.bits(mask).join(' ');
        else rot += 'vazia';
        b.setAttribute('aria-label', rot);
      }
      if (i === S.sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
    pintarPad();
  }

  function contagem(d) { let c = 0; for (let i = 0; i < S.G.N; i++) if (S.val[i] === d) c++; return c; }

  function pintarPad() {
    if (!S) return;
    const n = S.G.n;
    const nt = (S.sel >= 0 && !S.val[S.sel]) ? S.notas[S.sel] : 0;
    Array.prototype.forEach.call(el.pad.children, (b) => {
      const d = +b.dataset.d, falta = n - contagem(d);
      const feito = falta <= 0 && !S.modoNotas;
      b.classList.toggle('feito', feito);
      b.classList.toggle('nota-on', !!(nt & bit(d)));
      b.setAttribute('aria-disabled', feito ? 'true' : 'false');
      b.firstChild.nextSibling.textContent = falta > 0 ? falta : '';
      b.setAttribute('aria-label', 'Número ' + d + (falta > 0 ? ', faltam ' + falta : ', completo') + (nt & bit(d) ? ', está nas notas da célula' : ''));
    });
  }

  function pintarModo() {
    if (!S) return;
    el.modoNome.textContent = nomeVar(S.v) + ', ' + nomeNivel(S.nivel);
    el.modoNum.textContent = (S.dia ? 'Jogo do dia ' + dataBR(S.num) : 'Jogo ' + S.num) + (S.aprox ? ' (nível aproximado)' : '');
    el.modoMini.innerHTML = miniSVG(S.v, 56);
  }

  function hud() {
    if (!S) return;
    el.v1.textContent = fmtT(S.tempo);
    el.v2.textContent = S.erros;
    el.v3.textContent = S.dicas;
  }

  function ferramentas() {
    if (!S) return;
    const parado = S.fim || S.pausa || ocupado;
    el.notas.setAttribute('aria-pressed', String(S.modoNotas));
    el.desfazer.disabled = parado || !S.hist.length;
    el.refazer.disabled = parado || !S.refaz.length;
    el.apagar.disabled = parado;
    el.notas.disabled = parado;
    el.dica.disabled = parado;
    $('#verificar-btn').disabled = parado;
    $('#anotar-btn').disabled = parado;
    el.pad.classList.toggle('notas', S.modoNotas);
    el.pad.classList.toggle('parado', parado);
  }

  /* ==========================================================================
     4. Jogadas (números, notas, apagar, desfazer, verificar)
     ========================================================================== */
  function snap() {
    S.hist.push({ val: Int8Array.from(S.val), notas: Int16Array.from(S.notas), elim: Int16Array.from(S.elim), marcas: Uint8Array.from(S.marcas) });
    if (S.hist.length > 400) S.hist.shift();
    S.refaz.length = 0;
  }
  const atual = () => ({ val: Int8Array.from(S.val), notas: Int16Array.from(S.notas), elim: Int16Array.from(S.elim), marcas: Uint8Array.from(S.marcas) });
  function voltarPara(x) { S.val.set(x.val); S.notas.set(x.notas); S.elim.set(x.elim); S.marcas.set(x.marcas); }

  function depois(msg) {
    fecharDica(true);
    pintar(); hud(); ferramentas(); gravarPartida();
    if (msg) dizer(msg);
  }

  function selecionar(i) {
    if (!S || ocupado || S.pausa) return;
    S.sel = i;
    pintar();
  }

  function digitar(d) {
    if (!S || ocupado || S.fim || S.pausa) return;
    if (S.sel < 0) { dizer('Toque numa célula primeiro.'); return; }
    const i = S.sel;
    if (S.puz[i]) { dizer('Essa célula já vem pronta e não muda.'); return; }
    if (S.modoNotas) {
      if (S.val[i]) { dizer('Apague o número da célula para anotar nela.'); return; }
      snap();
      S.notas[i] ^= bit(d);
      ON.som('toque'); ON.vibrar('leve');
      depois();
      return;
    }
    if (S.val[i] === d) return;
    if (contagem(d) >= S.G.n) { dizer('O ' + d + ' já está completo na grade.'); return; }
    snap();
    colocarValor(i, d);
  }

  function unidadeCompleta(i) {
    const G = S.G, feitas = [];
    G.deCelula[i].forEach((k) => {
      let m = 0, ok = true;
      G.unidades[k].forEach((j) => { if (!S.val[j]) ok = false; else m |= bit(S.val[j]); });
      if (ok && m === G.cheia) feitas.push(k);
    });
    return feitas;
  }

  function colocarValor(i, d, deDica) {
    const G = S.G;
    S.val[i] = d; S.notas[i] = 0; S.marcas[i] = 0;
    if (prefs.limpa === 'sim') G.vizinhos[i].forEach((j) => { S.notas[j] &= ~bit(d); });
    const errado = d !== S.sol[i];
    let msg = '';
    if (errado && prefs.erros === 'hora' && !deDica) {
      const k = i * 16 + d;
      if (!S.contados.has(k)) { S.contados.add(k); S.erros++; }
      ON.som('erro'); ON.impacto(el.box, 'erro');
      msg = 'O ' + d + ' não é o certo para ' + SD.celNome(G, i) + '.';
    } else {
      const feitas = errado ? [] : unidadeCompleta(i);
      if (feitas.length) {
        ON.som('acerto'); ON.vibrar('toque');
        pulsar(feitas);
        msg = feitas.length > 1 ? 'Vários grupos completos.' : 'Completo: ' + SD.nomeUnidade(G, feitas[0]) + '.';
      } else { ON.som('toque'); ON.vibrar('leve'); }
    }
    depois(msg);
    if (!errado || prefs.erros === 'verificar') checarFim();
  }

  function pulsar(ks) {
    if (reduzido()) return;
    const set = new Set();
    ks.forEach((k) => S.G.unidades[k].forEach((j) => set.add(j)));
    set.forEach((j) => {
      const b = cels[j];
      b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso');
      setTimeout(() => b.classList.remove('pulso'), 700);
    });
  }

  function apagar() {
    if (!S || ocupado || S.fim || S.pausa) return;
    if (S.sel < 0) { dizer('Toque numa célula primeiro.'); return; }
    const i = S.sel;
    if (S.puz[i]) { dizer('Essa célula já vem pronta e não muda.'); return; }
    if (!S.val[i] && !S.notas[i]) { dizer('A célula já está vazia.'); return; }
    snap();
    S.val[i] = 0; S.notas[i] = 0; S.marcas[i] = 0;
    ON.som('toque'); ON.vibrar('leve');
    depois();
  }

  function desfazer() {
    if (!S || ocupado || S.fim || S.pausa || !S.hist.length) return;
    S.refaz.push(atual());
    voltarPara(S.hist.pop());
    ON.som('toque');
    depois();
  }
  function refazer() {
    if (!S || ocupado || S.fim || S.pausa || !S.refaz.length) return;
    S.hist.push(atual());
    voltarPara(S.refaz.pop());
    ON.som('toque');
    depois();
  }

  function alternarNotas() {
    if (!S || ocupado || S.fim || S.pausa) return;
    S.modoNotas = !S.modoNotas;
    ferramentas(); pintarPad();
    dizer(S.modoNotas ? 'Modo de notas ligado: os números viram anotações.' : 'Modo de notas desligado.', 3500);
  }

  function anotarTudo() {
    if (!S || ocupado || S.fim || S.pausa) return;
    const G = S.G;
    snap();
    for (let i = 0; i < G.N; i++) {
      if (S.val[i]) { S.notas[i] = 0; continue; }
      let m = 0;
      G.vizinhos[i].forEach((j) => { if (S.val[j]) m |= bit(S.val[j]); });
      S.notas[i] = G.cheia & ~m;
    }
    ON.som('junta');
    depois('Notas preenchidas em todas as células vazias.');
  }

  function verificar() {
    if (!S || ocupado || S.fim || S.pausa) return;
    const G = S.G;
    let errados = 0, novos = 0, vazias = 0;
    for (let i = 0; i < G.N; i++) {
      if (!S.val[i]) { vazias++; continue; }
      if (S.puz[i] || S.val[i] === S.sol[i]) { S.marcas[i] = 0; continue; }
      errados++; S.marcas[i] = 1;
      const k = i * 16 + S.val[i];
      if (!S.contados.has(k)) { S.contados.add(k); S.erros++; novos++; }
    }
    if (errados) {
      ON.som('erro'); ON.impacto(el.box, 'erro');
      depois(errados === 1 ? 'Há 1 número errado, marcado em vermelho.' : 'Há ' + errados + ' números errados, marcados em vermelho.');
    } else {
      ON.som('acerto');
      depois(vazias ? 'Tudo certo até aqui. Faltam ' + vazias + ' células.' : '');
    }
    if (!errados) checarFim();
  }

  function checarFim() {
    if (!S || S.fim) return;
    for (let i = 0; i < S.G.N; i++) if (S.val[i] !== S.sol[i]) {
      if (!S.val.some((v) => !v)) dizer('A grade está cheia, mas ainda tem número errado. Toque em Verificar a grade, em Ajudas.', 9000);
      return;
    }
    terminar();
  }

  /* ==========================================================================
     5. Dicas explicadas
     ========================================================================== */
  function estadoDica() {
    const G = S.G, g = new Array(G.N).fill(0);
    for (let i = 0; i < G.N; i++) if (S.puz[i] || (S.val[i] && S.val[i] === S.sol[i])) g[i] = S.val[i];
    const E = SD.novoEstado(G, g);
    for (let i = 0; i < G.N; i++) if (!E.val[i]) E.cand[i] &= ~S.elim[i];
    return E;
  }

  function abrirDica() {
    if (!S || ocupado || S.fim || S.pausa) return;
    if (S.dica) { fecharDica(); return; }
    const G = S.G;
    S.dicas++;
    let errada = -1;
    for (let i = 0; i < G.N; i++) if (S.val[i] && !S.puz[i] && S.val[i] !== S.sol[i]) { errada = i; break; }
    if (errada >= 0) {
      S.marcas[errada] = 1;
      S.sel = errada;
      S.dica = { tipo: 'erro', etapa: 1, p: { celulas: [errada], eliminar: [], tec: 'erro' } };
    } else {
      const E = estadoDica();
      let p = SD.proximoPasso(E, 6);
      let tipo = 'tec';
      if (!p) {
        let melhor = -1, mc = 99;
        for (let i = 0; i < G.N; i++) if (!E.val[i]) { const c = SD.contaBits(E.cand[i]); if (c < mc) { mc = c; melhor = i; } }
        if (melhor < 0) { S.dicas--; return; }
        p = { tec: 'revela', colocar: { i: melhor, d: S.sol[melhor] }, eliminar: [], celulas: [melhor], digitos: [S.sol[melhor]] };
        tipo = 'revela';
      }
      S.dica = { tipo, etapa: 1, p, cand: Int16Array.from(E.cand) };
      if (p.colocar) S.sel = p.colocar.i;
    }
    ON.som('junta');
    hud(); gravarPartida();
    desenharDica();
  }

  function fecharDica(silencio) {
    if (!S || !S.dica) return;
    S.dica = null;
    document.body.classList.remove('dica-aberta');
    el.acoes.hidden = true;
    el.acoes.replaceChildren();
    if (!silencio) { pintar(); ajustar(); }
  }

  function textoDica(d) {
    const G = S.G, p = d.p;
    if (d.tipo === 'erro') return { titulo: 'Número errado', texto: 'O número em ' + SD.celNome(G, p.celulas[0]) + ' não é o certo. Ele está marcado em vermelho. Apague e tente outro, ou toque em Apagar aqui.' };
    if (d.tipo === 'revela') return { titulo: 'Sem técnica curta', texto: 'Não achei uma jogada lógica curta agora. Posso mostrar uma célula: ' + SD.celNome(G, p.colocar.i) + ' é o ' + p.colocar.d + '.' };
    return SD.descrever(G, p);
  }

  function desenharDica() {
    const d = S.dica;
    if (!d) return;
    const G = S.G, t = textoDica(d);
    const nome = d.tipo === 'tec' ? (SD.NOMES_TECNICAS[d.p.tec] || t.titulo) : t.titulo;
    const bts = [];
    let corpo;
    if (d.tipo === 'erro') {
      corpo = t.texto;
      bts.push({ txt: 'Apagar o número', fn: () => { const i = d.p.celulas[0]; S.sel = i; fecharDica(true); apagar(); }, prim: true });
    } else if (d.etapa === 1) {
      corpo = d.tipo === 'tec'
        ? 'Existe uma jogada com esta técnica. Olhe as células marcadas em amarelo e veja se você a enxerga sozinho.'
        : 'Não achei uma técnica curta. Olhe a célula marcada em amarelo.';
      bts.push({ txt: 'Mostrar a explicação', fn: () => { d.etapa = 2; desenharDica(); }, prim: true });
    } else {
      corpo = t.texto;
      bts.push({ txt: d.p.colocar ? 'Colocar o ' + d.p.colocar.d : 'Aplicar', fn: aplicarDica, prim: true });
    }
    if (d.tipo === 'tec') bts.push({ txt: 'Como funciona', fn: () => abrirTecnica(d.p.tec) });
    bts.push({ txt: 'Fechar', fn: () => fecharDica() });

    const tit = document.createElement('p'); tit.className = 'acoes-tit'; tit.textContent = (d.tipo === 'erro' ? '' : 'Dica: ') + nome;
    const tx = document.createElement('p'); tx.className = 'acoes-txt'; tx.textContent = corpo;
    const linha = document.createElement('div'); linha.className = 'acoes-bts';
    bts.forEach((b) => {
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'btn ' + (b.prim ? 'btn-primary' : 'btn-secondary'); x.textContent = b.txt;
      x.addEventListener('click', b.fn);
      linha.appendChild(x);
    });
    el.acoes.replaceChildren(tit, tx, linha);
    el.acoes.hidden = false;
    document.body.classList.add('dica-aberta');
    pintar();
    ajustar();
    el.acoes.scrollIntoView({ block: 'nearest', behavior: reduzido() ? 'auto' : 'smooth' });
  }

  function aplicarDica() {
    const d = S.dica;
    if (!d) return;
    const p = d.p;
    snap();
    if (p.colocar) {
      S.dica = null;
      colocarValor(p.colocar.i, p.colocar.d, true);
      el.acoes.hidden = true; document.body.classList.remove('dica-aberta'); ajustar();
      return;
    }
    (p.eliminar || []).forEach((e) => { S.elim[e.i] |= bit(e.d); S.notas[e.i] &= ~bit(e.d); });
    ON.som('acerto'); ON.vibrar('toque');
    fecharDica(true);
    el.acoes.hidden = true; document.body.classList.remove('dica-aberta');
    pintar(); hud(); ferramentas(); gravarPartida(); ajustar();
    dizer('Feito: o número saiu das possibilidades. Peça outra dica quando quiser.');
  }

  /* ==========================================================================
     6. Relógio, pausa, fim da partida e estatísticas
     ========================================================================== */
  let tick = 0, ultimo = 0;
  function ligarRelogio() {
    clearInterval(tick);
    ultimo = Date.now();
    tick = setInterval(() => {
      const agora = Date.now(), dt = Math.min(agora - ultimo, 2000);
      ultimo = agora;
      if (!S || S.fim || S.pausa || ocupado || document.hidden || ON.modal.aberto()) return;
      S.acum += dt;
      const s = Math.floor(S.acum / 1000);
      if (s !== S.tempo) { S.tempo = s; el.v1.textContent = fmtT(s); if (s % 5 === 0) gravarPartida(); }
    }, 250);
  }

  function pausar(v) {
    if (!S || S.fim || ocupado) return;
    const novo = v === undefined ? !S.pausa : !!v;
    if (novo === S.pausa) return;
    S.pausa = novo;
    if (novo) telaPausa(); else fecharTela();
    ferramentas();
    gravarPartida();
  }

  function telaPausa(retomando) {
    mostrarTela({
      titulo: retomando ? 'Partida salva' : 'Pausado',
      corpo: '<p>' + (retomando ? 'Sua partida estava em andamento neste aparelho. O tempo está parado.' : 'O tabuleiro fica escondido enquanto o tempo está parado.') + '</p><p class="tela-sub">' + nomeVar(S.v) + ', ' + nomeNivel(S.nivel) + ' · tempo ' + fmtT(S.tempo) + '</p>',
      opaca: true, btn: 'Continuar', fn: () => { S.pausa = false; fecharTela(); ferramentas(); pintar(); }
    });
  }

  /* estatísticas */
  const statsPadrao = () => ({ jogos: 0, vit: 0, sem: 0, seg: 0, k: {} });
  function lerStats() { const s = sget(LS.stats, null); return (s && typeof s === 'object' && s.k) ? Object.assign(statsPadrao(), s) : statsPadrao(); }
  function contar(tipo, info) {
    const st = lerStats();
    const k = S.v + ':' + S.nivel;
    st.k[k] = Object.assign({ j: 0, w: 0, best: 0, soma: 0 }, st.k[k]);
    if (tipo === 'inicio') { st.jogos++; st.k[k].j++; }
    else if (tipo === 'vitoria') {
      st.vit++; st.seg += info.tempo; st.k[k].w++; st.k[k].soma += info.tempo;
      if (!info.erros) st.sem++;
      if (!st.k[k].best || info.tempo < st.k[k].best) st.k[k].best = info.tempo;
    }
    sset(LS.stats, st);
  }
  function sequenciaDias() {
    const d = sget(LS.dias, {}) || {};
    const dt = new Date();
    if (!d[SD.numeroDoDia(dt)]) dt.setDate(dt.getDate() - 1);
    let c = 0;
    while (d[SD.numeroDoDia(dt)]) { c++; dt.setDate(dt.getDate() - 1); }
    return c;
  }
  function estatisticas() {
    const st = lerStats();
    const L = [
      { rotulo: 'Partidas iniciadas', valor: st.jogos },
      { rotulo: 'Partidas terminadas', valor: st.vit },
      { rotulo: 'Sem nenhum erro', valor: st.sem },
      { rotulo: 'Dias seguidos (jogo do dia)', valor: sequenciaDias() },
      { rotulo: 'Tempo total jogando', valor: fmtT(Math.floor(st.seg)) }
    ];
    VARS.forEach((v) => niveisDe(v).forEach((n) => {
      const x = st.k[v + ':' + n];
      if (x && x.best) L.push({ rotulo: 'Melhor: ' + nomeVar(v) + ', ' + nomeNivel(n), valor: fmtT(x.best) });
    }));
    return L;
  }

  function terminar() {
    S.fim = true;
    fecharDica(true);
    const tempo = Math.floor(S.acum / 1000);
    S.tempo = tempo;
    const k = S.v + ':' + S.nivel;
    const antes = (lerStats().k[k] || {}).best || 0;
    contar('vitoria', { tempo, erros: S.erros });
    if (S.dia) { const d = sget(LS.dias, {}) || {}; d[S.num] = 1; sset(LS.dias, d); }
    sdel(LS.jogo);
    hud(); ferramentas(); pintar();
    ON.som('vitoria'); ON.vibrar('vitoria');
    if (!reduzido()) { el.tab.classList.add('onda'); setTimeout(() => el.tab.classList.remove('onda'), 1800); }
    const recorde = !antes || tempo < antes;
    const seq = S.dia ? sequenciaDias() : 0;
    let h = '<div class="res"><p class="res-motivo">' + nomeVar(S.v) + ', ' + nomeNivel(S.nivel) + ' · ' + (S.dia ? 'jogo do dia ' + dataBR(S.num) : 'jogo ' + S.num) + '</p>';
    h += '<div class="res-lin"><span>Tempo</span><b>' + fmtT(tempo) + '</b>' + (recorde ? '<small>' + (antes ? 'Novo recorde neste nível!' : 'Seu primeiro tempo neste nível.') + '</small>' : '<small>Melhor neste nível: ' + fmtT(antes) + '</small>') + '</div>';
    h += '<div class="res-lin"><span>Erros</span><b>' + S.erros + '</b>' + (S.erros ? '' : '<small>Sem nenhum erro.</small>') + '</div>';
    h += '<div class="res-lin"><span>Dicas</span><b>' + S.dicas + '</b></div>';
    if (seq > 1) h += '<div class="res-lin"><span>Dias seguidos</span><b>' + seq + '</b></div>';
    if (S.aprox) h += '<p class="tela-sub">Esta grade ficou no nível ' + nomeNivel(S.nivelReal) + ', perto do pedido.</p>';
    h += '</div>';
    setTimeout(() => {
      if (!S || !S.fim) return;
      mostrarTela({ titulo: 'Grade completa!', corpo: h, btn: 'Nova partida', fn: () => { fecharTela(); iniciar(S.v, S.nivel, sortear()); }, btn2: 'Ver a grade', fn2: () => { fecharTela(); dizer('Partida concluída. Toque em Nova partida para jogar outra.', 12000); } });
    }, reduzido() ? 200 : 900);
  }

  /* ==========================================================================
     7. Telas, escolher partida e Como Jogar
     ========================================================================== */
  function mostrarTela(o) {
    el.telaTitulo.textContent = o.titulo || '';
    el.telaCorpo.innerHTML = o.corpo || '';
    el.tela.classList.toggle('opaca', !!o.opaca);
    el.telaBtn.hidden = !o.btn;
    el.telaBtn.textContent = o.btn || '';
    el.telaBtn.onclick = o.fn || null;
    el.telaBtn2.hidden = !o.btn2;
    el.telaBtn2.textContent = o.btn2 || '';
    el.telaBtn2.onclick = o.fn2 || null;
    el.tela.hidden = false;
    el.tab.setAttribute('aria-hidden', o.opaca ? 'true' : 'false');
    if (o.btn && !ON.modal.aberto()) setTimeout(() => { if (!el.tela.hidden && !el.telaBtn.hidden) el.telaBtn.focus({ preventScroll: true }); }, 60);
  }
  function fecharTela() {
    el.tela.hidden = true;
    el.tab.setAttribute('aria-hidden', 'false');
  }

  /* miniatura da variante: grade com blocos (e as diagonais, no X) */
  function miniSVG(id, px) {
    const v = SD.VARIANTES[id], n = v.n, u = 10, W = n * u;
    let s = '<svg class="mini" xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ' + (W + 2) + ' ' + (W + 2) + '" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + W + '" class="m-fundo"/>';
    if (v.diag) for (let k = 0; k < n; k++) { s += '<rect x="' + (k * u) + '" y="' + (k * u) + '" width="' + u + '" height="' + u + '" class="m-diag"/>'; if (k !== n - 1 - k) s += '<rect x="' + ((n - 1 - k) * u) + '" y="' + (k * u) + '" width="' + u + '" height="' + u + '" class="m-diag"/>'; }
    for (let k = 1; k < n; k++) {
      s += '<path class="m-fina" d="M' + (k * u) + ' 0V' + W + 'M0 ' + (k * u) + 'H' + W + '"/>';
    }
    for (let k = 1; k < n; k++) {
      if (k % v.bc === 0) s += '<path class="m-grossa" d="M' + (k * u) + ' 0V' + W + '"/>';
      if (k % v.br === 0) s += '<path class="m-grossa" d="M0 ' + (k * u) + 'H' + W + '"/>';
    }
    s += '<rect x="0" y="0" width="' + W + '" height="' + W + '" class="m-borda"/></svg>';
    return s;
  }

  /* --- escolher partida --- */
  const esc = { v: 'classico', nivel: 2, num: '' };

  function abrirPartida() {
    esc.v = S ? S.v : prefs.v;
    esc.nivel = niveisDe(esc.v).indexOf(S ? S.nivel : prefs.niveis[esc.v]) >= 0 ? (S ? S.nivel : prefs.niveis[esc.v]) : prefs.niveis[esc.v];
    $('#num-jogo').value = '';
    $('#num-desc').textContent = TX.numDesc || 'O mesmo número, variante e nível dão sempre a mesma grade, em qualquer aparelho. Deixe vazio para sortear.';
    desenharEscolha();
  }

  function desenharEscolha() {
    const tv = $('#tiles-var');
    tv.replaceChildren(...VARS.map((v) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tile'; b.dataset.v = v;
      b.setAttribute('aria-current', String(v === esc.v));
      const ns = niveisDe(v);
      b.innerHTML = '<span class="tile-mini">' + miniSVG(v, 56) + '</span><span class="tile-txt"><span class="tile-nome">' + nomeVar(v) + '</span><span class="tile-dif">' + (ns.length === 1 ? 'Um nível' : 'Níveis 1 a ' + ns[ns.length - 1]) + '</span><span class="tile-desc">' + ((TX.varDesc || {})[v] || '') + '</span></span>';
      return b;
    }));
    const ns = niveisDe(esc.v);
    if (ns.indexOf(esc.nivel) < 0) esc.nivel = ns[ns.length - 1];
    $('#op-niveis').replaceChildren(...ns.map((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'seg-btn'; b.dataset.n = n; b.textContent = n + ' ' + nomeNivel(n);
      b.setAttribute('aria-pressed', String(n === esc.nivel));
      return b;
    }));
    $('#niveis-desc').textContent = (TX.nivelDesc || {})[esc.nivel] || '';
  }

  $('#tiles-var').addEventListener('click', (ev) => {
    const b = ev.target.closest('.tile'); if (!b) return;
    esc.v = b.dataset.v;
    esc.nivel = Math.min(prefs.niveis[esc.v], niveisDe(esc.v)[niveisDe(esc.v).length - 1]);
    desenharEscolha();
  });
  $('#op-niveis').addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg-btn'); if (!b) return;
    esc.nivel = +b.dataset.n; desenharEscolha();
  });
  $('#num-jogo').addEventListener('input', (ev) => {
    const v = ev.target.value.replace(/\D/g, '').slice(0, 9);
    if (v !== ev.target.value) ev.target.value = v;
    $('#num-desc').textContent = 'O mesmo número, variante e nível dão sempre a mesma grade, em qualquer aparelho. Deixe vazio para sortear.';
  });
  $('#num-sortear').addEventListener('click', () => { $('#num-jogo').value = String(sortear()); });
  $('#num-dia').addEventListener('click', () => {
    const n = SD.numeroDoDia();
    $('#num-jogo').value = String(n);
    $('#num-desc').textContent = 'Jogo do dia ' + dataBR(n) + ': quem escolher esta variante e este nível joga a mesma grade hoje.';
  });

  function jogou() { return !!(S && !S.fim && (S.val.some((v, i) => v !== S.puz[i]) || S.notas.some((m) => m))); }

  function jogarEscolha() {
    let num = parseInt($('#num-jogo').value, 10);
    if (!(num > 0)) num = sortear();
    const v = esc.v, n = esc.nivel;
    ON.novoJogo(jogou(), () => { ON.modal.fechar(); iniciar(v, n, num); }, { texto: 'A partida em andamento será abandonada.', sim: 'Sim, começar outra' });
  }
  $('#partida-jogar').addEventListener('click', jogarEscolha);
  $('#modo-btn').addEventListener('click', () => { abrirPartida(); });
  el.restart.addEventListener('click', () => {
    const v = S ? S.v : prefs.v, n = S ? S.nivel : prefs.niveis[v];
    ON.novoJogo(jogou(), () => iniciar(v, n, sortear()), { texto: 'A partida em andamento será abandonada.', sim: 'Sim, começar outra' });
  });

  /* --- Como Jogar --- */
  let abas = [];
  function mostrarAba(aba) {
    abas.forEach((a) => {
      const s = a === aba;
      a.setAttribute('aria-selected', String(s)); a.tabIndex = s ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !s;
    });
    document.getElementById(aba.getAttribute('aria-controls')).scrollTop = 0;
  }

  function exemploHTML(ex) {
    const G = SD.montar('classico'), p = ex.passo, t = SD.descrever(G, p);
    const foco = new Set(p.celulas), alvo = new Set((p.eliminar || []).map((e) => e.i));
    if (p.colocar) foco.add(p.colocar.i);
    let s = '<svg class="ex-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 92 92" role="img" aria-label="Exemplo da técnica no tabuleiro">';
    s += '<rect x="0" y="0" width="90" height="90" class="e-fundo"/>';
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      if (foco.has(i)) s += '<rect x="' + (c * 10) + '" y="' + (r * 10) + '" width="10" height="10" class="e-foco"/>';
      else if (alvo.has(i)) s += '<rect x="' + (c * 10) + '" y="' + (r * 10) + '" width="10" height="10" class="e-alvo"/>';
    }
    let d = '';
    for (let k = 1; k < 9; k++) d += 'M' + (k * 10) + ' 0V90M0 ' + (k * 10) + 'H90';
    s += '<path class="e-fina" d="' + d + '"/>';
    s += '<path class="e-grossa" d="M30 0V90M60 0V90M0 30H90M0 60H90"/><rect x="0" y="0" width="90" height="90" class="e-borda"/>';
    for (let i = 0; i < 81; i++) {
      const dg = +ex.grade[i];
      const r = Math.floor(i / 9), c = i % 9;
      if (dg) s += '<text x="' + (c * 10 + 5) + '" y="' + (r * 10 + 7.4) + '" class="e-num">' + dg + '</text>';
      else if (p.colocar && p.colocar.i === i) s += '<text x="' + (c * 10 + 5) + '" y="' + (r * 10 + 7.4) + '" class="e-novo">' + p.colocar.d + '</text>';
    }
    s += '</svg>';
    const celulas = Array.from(new Set(p.celulas.concat((p.eliminar || []).map((e) => e.i)))).sort((a, b) => a - b);
    let li = '';
    celulas.forEach((i) => {
      const mask = ex.cand[i];
      if (!mask) return;
      const saem = (p.eliminar || []).filter((e) => e.i === i).reduce((a, e) => a | bit(e.d), 0);
      const nums = SD.bits(mask).map((x) => (saem & bit(x) ? '<span class="sai">' + x + '</span>' : String(x))).join(' ');
      li += '<li><b>' + SD.celNome(G, i) + '</b>: ' + nums + '</li>';
    });
    return '<div class="ex">' + s + '<div class="ex-lado"><p>' + t.texto + '</p>' + (li ? '<p class="ex-leg">Possibilidades nas células marcadas (o que sai fica em vermelho):</p><ul class="ex-cands">' + li + '</ul>' : '') + '</div></div>';
  }

  function montarAjuda() {
    $('#painel-site').innerHTML = TX.site || '';
    $('#painel-sudoku').innerHTML = TX.sudoku || '';
    const ex = {};
    (SD.EXEMPLOS || []).forEach((e) => { ex[e.tec] = e; });
    let h = TX.tecIntro || '';
    (TX.tec || []).forEach((t) => {
      h += '<details id="tec-' + t.id + '"><summary><span>' + t.nome + '</span><small>Nível ' + t.nivel + '</small></summary><div class="tec-corpo">' + t.como.map((x) => '<p>' + x + '</p>').join('') + (ex[t.id] ? '<h4>Exemplo</h4>' + exemploHTML(ex[t.id]) : '') + '</div></details>';
    });
    $('#painel-tec').innerHTML = h;
  }

  function ligarAbas() {
    abas = Array.from(document.querySelectorAll('.aba'));
    abas.forEach((a) => {
      a.addEventListener('click', () => mostrarAba(a));
      a.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        const novo = abas[(abas.indexOf(a) + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
        mostrarAba(novo); novo.focus(); ev.preventDefault();
      });
    });
    $('#howto-btn').addEventListener('click', () => mostrarAba(abas[0]));
  }

  function abrirTecnica(id) {
    ON.modal.abrir('howto-modal');
    mostrarAba(abas[2]);
    const d = document.getElementById('tec-' + id);
    if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start' }), 60); }
  }

  /* --- ajudas (painel no fim da tela) --- */
  const AJ_TXT = { hora: 'Erros na hora', verificar: 'Erros só ao verificar' };
  function pintarAjudas() {
    ['erros', 'conf', 'igual', 'limpa'].forEach((k) => {
      const box = { erros: '#op-erros', conf: '#op-conf', igual: '#op-igual', limpa: '#op-limpa' }[k];
      document.querySelectorAll(box + ' .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === prefs[k])));
    });
    $('#ajuda-atual').textContent = AJ_TXT[prefs.erros];
  }
  ['erros', 'conf', 'igual', 'limpa'].forEach((k) => {
    const box = { erros: '#op-erros', conf: '#op-conf', igual: '#op-igual', limpa: '#op-limpa' }[k];
    $(box).addEventListener('click', (ev) => {
      const b = ev.target.closest('.seg-btn'); if (!b) return;
      prefs[k] = b.dataset.v; gravarPrefs(); pintarAjudas(); pintar();
    });
  });
  $('#verificar-btn').addEventListener('click', verificar);
  $('#anotar-btn').addEventListener('click', anotarTudo);

  /* ==========================================================================
     8. Tamanho, teclado e início
     ========================================================================== */
  let hEntrada = 0;

  /* O tabuleiro é quadrado e ocupa o maior lado que cabe: a coluna toda na horizontal, e a altura que sobra
     (na tela em pé, depois de partida, placar e números; deitada, a janela abaixo do cabeçalho). */
  function ajustar() {
    if (!S) return;
    const G = S.G;
    const lado = window.matchMedia('(orientation: landscape) and (min-width: 540px)').matches;
    const cs = getComputedStyle(el.area);
    const gap = parseFloat(cs.rowGap) || 10;
    const areaW = el.area.clientWidth;
    const hh = (document.querySelector('header') || {}).offsetHeight || 60;
    const vh = window.innerHeight || 700;
    let larg = areaW, maxH;
    if (lado) {
      const painel = $('#modo-btn').offsetWidth;
      larg = areaW - painel - (parseFloat(cs.columnGap) || 10);
      maxH = vh - hh - 22;
    } else {
      const eh = el.entrada.offsetHeight;
      if (eh) hEntrada = eh;
      const fixo = $('#modo-btn').offsetHeight + $('#hud').offsetHeight + (hEntrada || 150) + gap * 4 + 14;
      maxH = vh - hh - fixo;
    }
    const cap = 760;
    let L = Math.min(larg, cap);
    L = Math.max(Math.min(L, Math.max(maxH, Math.min(L, 250))), 150);
    L = Math.floor(L / G.n) * G.n;   // células de tamanho inteiro: linhas finas nítidas
    el.box.style.setProperty('--lado', L + 'px');
    const pw = el.pad.clientWidth || (lado ? $('#modo-btn').offsetWidth : areaW);
    el.pad.style.setProperty('--cols', pw / G.n >= 34 ? G.n : Math.ceil(G.n / 2));
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(ajustar, 60); });
  window.addEventListener('orientationchange', () => setTimeout(ajustar, 200));

  /* --- ligações --- */
  el.tab.addEventListener('click', (ev) => { const b = ev.target.closest('.cel'); if (b) selecionar(+b.dataset.i); });
  el.pad.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pad-btn'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { dizer('O ' + b.dataset.d + ' já está completo na grade.'); return; }
    digitar(+b.dataset.d);
  });
  el.notas.addEventListener('click', alternarNotas);
  el.apagar.addEventListener('click', apagar);
  el.desfazer.addEventListener('click', desfazer);
  el.refazer.addEventListener('click', refazer);
  el.dica.addEventListener('click', abrirDica);
  el.tempoBtn.addEventListener('click', () => pausar());

  document.addEventListener('keydown', (ev) => {
    if (!S || ocupado || ON.modal.aberto()) return;
    const t = ev.target;
    if (t && t.closest && t.closest('input,textarea,select,[role="dialog"],#acoes')) return;
    const k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      if (k === 'z' || k === 'Z') { (ev.shiftKey ? refazer : desfazer)(); ev.preventDefault(); }
      else if (k === 'y' || k === 'Y') { refazer(); ev.preventDefault(); }
      return;
    }
    if (ev.altKey) return;
    if (S.fim) return;
    if (k === 'p' || k === 'P') { pausar(); ev.preventDefault(); return; }
    if (S.pausa) return;
    const n = S.G.n;
    if (/^[1-9]$/.test(k) && +k <= n) { digitar(+k); ev.preventDefault(); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { apagar(); ev.preventDefault(); return; }
    if (k === 'n' || k === 'N') { alternarNotas(); ev.preventDefault(); return; }
    if (k === 'z' || k === 'Z') { desfazer(); ev.preventDefault(); return; }
    if (k === 'y' || k === 'Y') { refazer(); ev.preventDefault(); return; }
    if (k === 'h' || k === 'H') { abrirDica(); ev.preventDefault(); return; }
    const mov = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k];
    if (mov) {
      const dentro = !t || t === document.body || (t.closest && (t.closest('#tab') || t.closest('#entrada')));
      if (!dentro) return;
      const cur = S.sel < 0 ? 0 : S.sel;
      const r = Math.max(0, Math.min(n - 1, Math.floor(cur / n) + mov[0])), c = Math.max(0, Math.min(n - 1, (cur % n) + mov[1]));
      selecionar(r * n + c);
      if (cels[S.sel]) cels[S.sel].focus({ preventScroll: true });
      ev.preventDefault();
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) gravarPartida(); else ultimo = Date.now(); });
  window.addEventListener('pagehide', gravarPartida);

  /* ícones das ferramentas (traços simples, herdam a cor do texto) */
  const IC = {
    notas: '<path d="M3 13l.8-3.2L11 2.6a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2L6.2 12.2z"/><path d="M9.8 3.8l2.4 2.4"/>',
    apagar: '<path d="M3 3l10 10M13 3L3 13"/>',
    desfazer: '<path d="M5 3L2.5 5.5 5 8"/><path d="M2.8 5.5H9a4 4 0 0 1 0 8H5.5"/>',
    refazer: '<path d="M11 3l2.5 2.5L11 8"/><path d="M13.2 5.5H7a4 4 0 0 0 0 8h3.5"/>',
    dica: '<path d="M5.5 11.5c0-1.2-1.8-2-1.8-4.3a4.3 4.3 0 0 1 8.6 0c0 2.3-1.8 3.1-1.8 4.3z"/><path d="M6 14h4"/>'
  };
  function iconesFerramentas() {
    [['notas', el.notas], ['apagar', el.apagar], ['desfazer', el.desfazer], ['refazer', el.refazer], ['dica', el.dica]].forEach(([k, b]) => {
      const txt = b.textContent;
      b.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[k] + '</svg><span>' + txt + '</span>';
    });
  }

  /* ==========================================================================
     Início
     ========================================================================== */
  ON.init({
    id: 'sudokuon',
    nome: 'SudokuON!',
    configuracoes: ['som', 'vibracao', 'tremor', 'escuro', 'reduzir'],
    estatisticas,
    zerarEstatisticas: () => { sdel(LS.stats); sdel(LS.dias); },
    pronto: () => {
      document.getElementById('modo-chevron').innerHTML = ON.icone('chevron', 16);
      document.getElementById('ajuda-chevron').innerHTML = ON.icone('chevron', 18);
      iconesFerramentas();
      montarAjuda();
      ligarAbas();
      pintarAjudas();
      ligarRelogio();
      if (!restaurar()) iniciar(prefs.v, prefs.niveis[prefs.v], sortear());
      // primeira visita: o Como Jogar abre sozinho
      if (!ON.store.get(LS.visto, false)) {
        ON.store.set(LS.visto, true);
        setTimeout(() => ON.modal.abrir('howto-modal'), 400);
      }
    }
  });
})();
