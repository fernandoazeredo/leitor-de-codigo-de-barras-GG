import type { ProdutoFabricante, ProdutoGG } from './types';

export function normalizar(v = '') {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(v: string) { return new Set(normalizar(v).split(' ').filter(x => x.length > 1)); }
export function scoreProduto(f: ProdutoFabricante, g: ProdutoGG) {
  const a = tokens([f.produto, f.marca, f.embalagem, f.volumePeso].filter(Boolean).join(' '));
  const b = tokens([g.produto, g.marca, g.embalagem, g.volumePeso].filter(Boolean).join(' '));
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  return Math.round((2 * inter / (a.size + b.size)) * 100);
}
export function melhoresCandidatos(f: ProdutoFabricante, produtos: ProdutoGG[], limite = 5) {
  return produtos.map(p => ({ produto: p, score: scoreProduto(f, p) })).sort((a,b) => b.score - a.score).slice(0, limite);
}
