import * as XLSX from 'xlsx';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

const text = (v: unknown) => String(v ?? '').trim();

export async function importarFabricantes(file: File): Promise<ProdutoFabricante[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return data.map((r, i) => ({
    id: text(r.CODIGO_FABRICANTE || r.EAN || r.GTIN || `linha-${i+2}`),
    codigoFabricante: text(r.CODIGO_FABRICANTE || r.EAN || r.GTIN),
    produto: text(r.PRODUTO || r.DESCRICAO),
    marca: text(r.MARCA), embalagem: text(r.EMBALAGEM), volumePeso: text(r.VOLUME_PESO || r.VOLUME || r.PESO), observacao: text(r.OBSERVACAO)
  })).filter(x => x.codigoFabricante && x.produto);
}

export async function importarProdutosGG(file: File): Promise<ProdutoGG[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return data.map((r, i) => ({
    id: text(r.CODIGO_AUTOMATICO || r.CODIGO_INTERNO || `linha-${i+2}`),
    codigoAutomatico: text(r.CODIGO_AUTOMATICO || r.CODIGO_INTERNO),
    codigoManual: text(r.CODIGO_MANUAL),
    produto: text(r.PRODUTO || r.DESCRICAO),
    marca: text(r.MARCA), embalagem: text(r.EMBALAGEM), volumePeso: text(r.VOLUME_PESO || r.VOLUME || r.PESO), observacao: text(r.OBSERVACAO)
  })).filter(x => x.codigoAutomatico && x.produto);
}

function baixar(nome: string, sheets: Record<string, Record<string, unknown>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([n, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), n));
  XLSX.writeFile(wb, nome);
}

export function exportarFabricantes(rows: ProdutoFabricante[]) {
  baixar('PRODUTOS_FABRICANTES_GG.xlsx', { Fabricantes: rows.map(x => ({ CODIGO_FABRICANTE:x.codigoFabricante, PRODUTO:x.produto, MARCA:x.marca, EMBALAGEM:x.embalagem, VOLUME_PESO:x.volumePeso, OBSERVACAO:x.observacao })) });
}
export function exportarProdutosGG(rows: ProdutoGG[]) {
  baixar('PRODUTOS_GG.xlsx', { 'Codigos GG': rows.map(x => ({ CODIGO_AUTOMATICO:x.codigoAutomatico, CODIGO_MANUAL:x.codigoManual, PRODUTO:x.produto, MARCA:x.marca, EMBALAGEM:x.embalagem, VOLUME_PESO:x.volumePeso, OBSERVACAO:x.observacao })) });
}
export function exportarConsolidado(fabricantes: ProdutoFabricante[], produtos: ProdutoGG[], corrs: Correspondencia[]) {
  const byFab = new Map(fabricantes.map(x => [x.codigoFabricante, x]));
  const byGG = new Map(produtos.map(x => [x.id, x]));
  const confirmados = corrs.filter(x => x.status === 'CONFIRMADO').map(c => {
    const f = byFab.get(c.codigoFabricante); const g = byGG.get(c.produtoGGId);
    return { CODIGO_FABRICANTE:c.codigoFabricante, PRODUTO_FABRICANTE:f?.produto ?? c.produtoFabricante, CODIGO_GG_AUTOMATICO:g?.codigoAutomatico ?? c.codigoAutomatico, CODIGO_GG_MANUAL:g?.codigoManual ?? c.codigoManual, PRODUTO_GG:g?.produto ?? c.produtoGG, STATUS:c.status, COMPATIBILIDADE:`${c.score}%` };
  });
  const vinculados = new Set(corrs.map(x => x.codigoFabricante));
  const sem = fabricantes.filter(x => !vinculados.has(x.codigoFabricante)).map(f => ({ CODIGO_FABRICANTE:f.codigoFabricante, PRODUTO_FABRICANTE:f.produto, CODIGO_GG_AUTOMATICO:'', CODIGO_GG_MANUAL:'', PRODUTO_GG:'', STATUS:'SEM CORRESPONDÊNCIA', COMPATIBILIDADE:'' }));
  baixar('BASE_CONSOLIDADA_CODIGOS_GG.xlsx', { 'Base Consolidada': [...confirmados, ...sem], 'Sem Correspondencia': sem });
}

export function modeloFabricantes() {
  baixar('MODELO_FABRICANTES_GG.xlsx', { Fabricantes:[{ CODIGO_FABRICANTE:'7894900011517', PRODUTO:'Coca-Cola Original PET 2L', MARCA:'Coca-Cola', EMBALAGEM:'PET', VOLUME_PESO:'2 L', OBSERVACAO:'' }] });
}
export function modeloProdutosGG() {
  baixar('MODELO_CODIGOS_GG.xlsx', { 'Codigos GG':[{ CODIGO_AUTOMATICO:'15427', CODIGO_MANUAL:'CC2L', PRODUTO:'Refrigerante Coca-Cola Original PET 2 Litros', MARCA:'Coca-Cola', EMBALAGEM:'PET', VOLUME_PESO:'2 L', OBSERVACAO:'' }] });
}
