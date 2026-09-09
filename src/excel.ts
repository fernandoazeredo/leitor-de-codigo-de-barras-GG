import * as XLSX from 'xlsx';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

export type ProdutoGGManualImport = { produto: string; codigoManual: string };
export type ProdutoGGAutomaticoImport = { produto: string; codigoAutomatico: string };

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
    const codigoFabricante = pick(r, 'CODIGO_FABRICANTE', 'CODIGO FABRICANTE', 'EAN', 'GTIN', 'COD. BARRAS', 'COD BARRAS');
    const produto = pick(r, 'PRODUTO', 'DESCRICAO', 'PRODUTO/SERVICO', 'PRODUTO SERVICO');

    return {
      id: codigoFabricante || `linha-${i + 2}`,
      codigoFabricante,
      produto,
      marca: pick(r, 'MARCA'),
      embalagem: pick(r, 'EMBALAGEM'),
      volumePeso: pick(r, 'VOLUME_PESO', 'VOLUME PESO', 'VOLUME', 'PESO'),
      observacao: pick(r, 'OBSERVACAO')
    };
  }).filter(x => x.codigoFabricante && x.produto);
}

export async function importarGGManual(file: File): Promise<ProdutoGGManualImport[]> {
  const data = await lerPrimeiraPlanilha(file);
  return data.map(raw => {
    const r = normalizarLinha(raw);
    return {
      produto: pick(r, 'PRODUTO/SERVICO', 'PRODUTO SERVICO', 'PRODUTO', 'DESCRICAO'),
      codigoManual: pick(r, 'COD.', 'COD', 'CODIGO_MANUAL', 'CODIGO MANUAL')
    };
  }).filter(x => x.codigoManual && x.produto);
}

export async function importarGGAutomatico(file: File): Promise<ProdutoGGAutomaticoImport[]> {
  const data = await lerPrimeiraPlanilha(file);
  return data.map(raw => {
    const r = normalizarLinha(raw);
    return {
      produto: pick(r, 'PRODUTO/SERVICO', 'PRODUTO SERVICO', 'PRODUTO', 'DESCRICAO'),
      codigoAutomatico: pick(r, 'COD. BARRAS', 'COD BARRAS', 'CODIGO BARRAS', 'CODIGO_AUTOMATICO', 'CODIGO AUTOMATICO', 'CODIGO_INTERNO')
    };
  }).filter(x => x.codigoAutomatico && x.produto);
}

// Compatibilidade com arquivos GG que contenham as duas colunas no mesmo arquivo.
export async function importarProdutosGG(file: File): Promise<ProdutoGG[]> {
  const [manuais, automaticos] = await Promise.all([importarGGManual(file), importarGGAutomatico(file)]);
  const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const map = new Map<string, ProdutoGG>();

  automaticos.forEach(x => map.set(key(x.produto), {
    id: x.codigoAutomatico,
    codigoAutomatico: x.codigoAutomatico,
    produto: x.produto
  }));

  manuais.forEach(x => {
    const k = key(x.produto);
    const atual = map.get(k);
    if (atual) atual.codigoManual = x.codigoManual;
    else map.set(k, { id: `manual-${x.codigoManual}`, codigoAutomatico: '', codigoManual: x.codigoManual, produto: x.produto });
  });

  return [...map.values()];
}

function baixar(nome: string, sheets: Record<string, Record<string, unknown>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([n, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), n));
  XLSX.writeFile(wb, nome);
}

export function exportarFabricantes(rows: ProdutoFabricante[]) {
  baixar('PLANILHA_1_FABRICANTES.xlsx', { Fabricantes: rows.map(x => ({
    CODIGO_FABRICANTE: x.codigoFabricante,
    PRODUTO: x.produto,
    MARCA: x.marca ?? '',
    EMBALAGEM: x.embalagem ?? '',
    VOLUME_PESO: x.volumePeso ?? '',
    OBSERVACAO: x.observacao ?? ''
  })) });
}

export function exportarGGManual(rows: ProdutoGG[]) {
  baixar('PLANILHA_2_GG_MANUAL.xlsx', { 'GG Manual': rows.filter(x => x.codigoManual).map(x => ({
    'Produto/Serviço': x.produto,
    'Cód.': x.codigoManual ?? ''
  })) });
}

export function exportarGGAutomatico(rows: ProdutoGG[]) {
  baixar('PLANILHA_3_GG_AUTOMATICO.xlsx', { 'GG Automatico': rows.filter(x => x.codigoAutomatico).map(x => ({
    'Produto/Serviço': x.produto,
    'Cód. Barras': x.codigoAutomatico
  })) });
}

// Mantido para compatibilidade interna; gera as duas colunas GG juntas quando necessário.
export function exportarProdutosGG(rows: ProdutoGG[]) {
  baixar('PRODUTOS_GG_COMPLETO.xlsx', { 'Codigos GG': rows.map(x => ({
    'Produto/Serviço': x.produto,
    'Cód.': x.codigoManual ?? '',
    'Cód. Barras': x.codigoAutomatico
  })) });
}

export function exportarConsolidado(fabricantes: ProdutoFabricante[], produtos: ProdutoGG[], corrs: Correspondencia[]) {
  const byFab = new Map(fabricantes.map(x => [x.codigoFabricante, x]));
  const byGG = new Map(produtos.map(x => [x.id, x]));
  const confirmados = corrs.filter(x => x.status === 'CONFIRMADO').map(c => {
    const f = byFab.get(c.codigoFabricante); const g = byGG.get(c.produtoGGId);
    return {
      CODIGO_FABRICANTE: c.codigoFabricante,
      PRODUTO_FABRICANTE: f?.produto ?? c.produtoFabricante,
      CODIGO_GG_AUTOMATICO: g?.codigoAutomatico ?? c.codigoAutomatico,
      CODIGO_GG_MANUAL: g?.codigoManual ?? c.codigoManual,
      PRODUTO_GG: g?.produto ?? c.produtoGG,
      STATUS: c.status,
      COMPATIBILIDADE: `${c.score}%`
    };
  });
  const vinculados = new Set(corrs.map(x => x.codigoFabricante));
  const sem = fabricantes.filter(x => !vinculados.has(x.codigoFabricante)).map(f => ({
    CODIGO_FABRICANTE: f.codigoFabricante,
    PRODUTO_FABRICANTE: f.produto,
    CODIGO_GG_AUTOMATICO: '',
    CODIGO_GG_MANUAL: '',
    PRODUTO_GG: '',
    STATUS: 'SEM CORRESPONDÊNCIA',
    COMPATIBILIDADE: ''
  }));
  baixar('RELATORIO_CONSOLIDADO_CODIGOS_GG.xlsx', { 'Base Consolidada': [...confirmados, ...sem], 'Sem Correspondencia': sem });
}

export function modeloFabricantes() {
  baixar('MODELO_PLANILHA_1_FABRICANTES.xlsx', { Fabricantes:[{
    CODIGO_FABRICANTE:'7894900011517',
    PRODUTO:'Coca-Cola Original PET 2L',
    MARCA:'Coca-Cola',
    EMBALAGEM:'PET',
    VOLUME_PESO:'2 L',
    OBSERVACAO:''
  }] });
}

export function modeloGGManual() {
  baixar('MODELO_PLANILHA_2_GG_MANUAL.xlsx', { 'GG Manual':[
    { 'Produto/Serviço':'COCA COLA ZERO PET 1,5L C6', 'Cód.':'101' }
  ] });
}

export function modeloGGAutomatico() {
  baixar('MODELO_PLANILHA_3_GG_AUTOMATICO.xlsx', { 'GG Automatico':[
    { 'Produto/Serviço':'COCA COLA ZERO PET 1,5L C6', 'Cód. Barras':'2553317150213' }
  ] });
}

export function modeloProdutosGG() {
  baixar('MODELO_CODIGOS_GG_COMPLETO.xlsx', { 'Codigos GG':[
    { 'Produto/Serviço':'COCA COLA ZERO PET 1,5L C6', 'Cód.':'101', 'Cód. Barras':'2553317150213' }
  ] });
}
