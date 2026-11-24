/* SudokuON! - gerador-worker.js: cria a partida fora da tela principal (nível alto pode levar alguns décimos de segundo) */
'use strict';
importScripts('regras.js', 'tecnicas.js', 'gerador.js');
self.onmessage = function (ev) {
  const m = ev.data;
  try { self.postMessage({ id: m.id, r: self.Sudoku.gerar(m.variante, m.nivel, m.semente) }); }
  catch (e) { self.postMessage({ id: m.id, erro: String(e && e.message || e) }); }
};
