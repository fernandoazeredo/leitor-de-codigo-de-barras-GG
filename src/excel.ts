import * as XLSX from 'xlsx';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

const text = (v: unknown) => String(v ?? '').trim();

function normalizarCabecalho(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizarLinha(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    out[normalizarCabecalho(key)] = value;
  });
  return out;
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = text(row[normalizarCabecalho(key)]);
    if (value) return value;
  }
  return '';
}

async function lerPrimeiraPlanilha(file: File) {
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;

  try {
    wb = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: false });
  } catch {
    const htmlOuTexto = await file.text();
    wb = XLSX.read(htmlOuTexto, { type: 'string', cellText: true, cellDates: false });
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [] as Record<string, unknown>[];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });
}

export async function importarFabricantes(file: File): Promise<ProdutoFabricante[]> {
  const data = await lerPrimeiraPlanilha(file);
  return data.map((raw, i) => {
    const r = normalizarLinha(raw);
    const codigoFabricante = pick(r, 'CODIGO_FABRICANTE', 'EAN', 'GTIN');
    const produto = pick(r, 'PRODUTO', 'DESCRICAO', 'PRODUTO/SERVICO');

    return {
      id: codigoFabricante || `linha-${i + 2}`,
      codigoFabricante,
      produto,
      marca: pick(r, 'MARCA'),
      embalagem: pick(r, 'EMBALAGEM'),
      volumePeso: pick(r, 'VOLUME_PESO', 'VOLUME', 'PESO'),
      observacao: pick(r, 'OBSERVACAO')
    };
  }).filter(x => x.codigoFabricante && x.produto);
}

export async function importarProdutosGG(file: File): Promise<ProdutoGG[]> {
  const data = await lerPrimeiraPlanilha(file);

  return data.map((raw, i) => {
    const r = normalizarLinha(raw);

    // Layout oficial da base GG:
    // Produto/Serviço = descrição
    // Cód.            = código manual
    // Cód. Barras     = código automático
    const codigoAutomatico = pick(
      r,
      'COD. BARRAS',
      'COD BARRAS',
      'CODIGO BARRAS',
      'CODIGO_AUTOMATICO',
      'CODIGO_INTERNO'
    );
    const codigoManual = pick(r, 'COD.', 'COD', 'CODIGO_MANUAL');
    const produto = pick(r, 'PRODUTO/SERVICO', 'PRODUTO', 'DESCRICAO');

    return {
      id: codigoAutomatico || `linha-${i + 2}`,
      codigoAutomatico,
      codigoManual,
      produto
    };
  }).filter(x => x.codigoAutomatico && x.produto);
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
  baixar('PRODUTOS_GG.xlsx', { 'Codigos GG': rows.map(x => ({
    'Produto/Serviço': x.produto,
    'Cód.': x.codigoManual,
    'Cód. Barras': x.codigoAutomatico
  })) });
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
  baixar('MODELO_CODIGOS_GG.xlsx', { 'Codigos GG':[
    { 'Produto/Serviço':'COCA COLA ZERO PET 1,5L C6', 'Cód.':'101', 'Cód. Barras':'2553317150213' }
  ] });
}
