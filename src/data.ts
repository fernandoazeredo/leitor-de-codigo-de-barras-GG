import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { Correspondencia, HistoricoComparacao, ProdutoFabricante, ProdutoGG } from './types';

const KEYS = {
  fabricantes: 'gg_fabricantes',
  produtos: 'gg_produtos',
  correspondencias: 'gg_correspondencias',
  historico: 'gg_historico_comparacoes',
};

const demoFabricantes: ProdutoFabricante[] = [
  { id: '7894900011517', codigoFabricante: '7894900011517', produto: 'Coca-Cola Original PET 2L', marca: 'Coca-Cola', embalagem: 'PET', volumePeso: '2 L' },
];
const demoGG: ProdutoGG[] = [
  { id: '15427', codigoAutomatico: '15427', codigoManual: 'CC2L', produto: 'Refrigerante Coca-Cola Original PET 2 Litros', marca: 'Coca-Cola', embalagem: 'PET', volumePeso: '2 L' },
];

function getLocal<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback; }
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function setLocal<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

async function comFallback<T>(operacao: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!firebaseEnabled || !db) return await fallback();
  try {
    return await operacao();
  } catch (error) {
    console.warn('Firebase indisponível nesta etapa; usando base local temporária.', error);
    return await fallback();
  }
}

export async function listarFabricantes(): Promise<ProdutoFabricante[]> {
  return comFallback(async () => {
    const snap = await getDocs(collection(db, 'produtos_fabricantes'));
    return snap.docs.map(d => d.data() as ProdutoFabricante);
  }, () => getLocal(KEYS.fabricantes, demoFabricantes));
}

export async function listarProdutosGG(): Promise<ProdutoGG[]> {
  return comFallback(async () => {
    const snap = await getDocs(collection(db, 'produtos_gg'));
    return snap.docs.map(d => d.data() as ProdutoGG);
  }, () => getLocal(KEYS.produtos, demoGG));
}

export async function listarCorrespondencias(): Promise<Correspondencia[]> {
  return comFallback(async () => {
    const snap = await getDocs(collection(db, 'correspondencias'));
    return snap.docs.map(d => d.data() as Correspondencia);
  }, () => getLocal(KEYS.correspondencias, [] as Correspondencia[]));
}

export async function listarHistorico(): Promise<HistoricoComparacao[]> {
  return comFallback(async () => {
    const snap = await getDocs(collection(db, 'historico_comparacoes'));
    return snap.docs
      .map(d => d.data() as HistoricoComparacao)
      .sort((a,b) => b.dataHora.localeCompare(a.dataHora));
  }, () => getLocal(KEYS.historico, [] as HistoricoComparacao[]).sort((a,b)=>b.dataHora.localeCompare(a.dataHora)));
}

export async function salvarFabricantes(rows: ProdutoFabricante[], substituir = false) {
  if (!firebaseEnabled || !db) {
    const atual = substituir ? [] : await listarFabricantes();
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    rows.forEach(x => map.set(x.codigoFabricante, x));
    setLocal(KEYS.fabricantes, [...map.values()]);
    return;
  }

  try {
    if (substituir) {
      const atuais = await getDocs(collection(db, 'produtos_fabricantes'));
      await Promise.all(atuais.docs.map(x => deleteDoc(doc(db, 'produtos_fabricantes', x.id))));
    }
    await Promise.all(rows.map(x => setDoc(doc(db, 'produtos_fabricantes', x.codigoFabricante), x)));
  } catch (error) {
    console.warn('Não foi possível gravar no Firebase; salvando localmente.', error);
    const atual = substituir ? [] : getLocal(KEYS.fabricantes, demoFabricantes);
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    rows.forEach(x => map.set(x.codigoFabricante, x));
    setLocal(KEYS.fabricantes, [...map.values()]);
  }
}

export async function salvarProdutosGG(rows: ProdutoGG[], substituir = false) {
  if (!firebaseEnabled || !db) {
    const atual = substituir ? [] : await listarProdutosGG();
    const map = new Map(atual.map(x => [x.id, x]));
    rows.forEach(x => map.set(x.id, x));
    setLocal(KEYS.produtos, [...map.values()]);
    return;
  }

  try {
    if (substituir) {
      const atuais = await getDocs(collection(db, 'produtos_gg'));
      await Promise.all(atuais.docs.map(x => deleteDoc(doc(db, 'produtos_gg', x.id))));
    }
    await Promise.all(rows.map(x => setDoc(doc(db, 'produtos_gg', x.id), x)));
  } catch (error) {
    console.warn('Não foi possível gravar no Firebase; salvando localmente.', error);
    const atual = substituir ? [] : getLocal(KEYS.produtos, demoGG);
    const map = new Map(atual.map(x => [x.id, x]));
    rows.forEach(x => map.set(x.id, x));
    setLocal(KEYS.produtos, [...map.values()]);
  }
}

export async function salvarCorrespondencia(item: Correspondencia) {
  if (!firebaseEnabled || !db) {
    const atual = await listarCorrespondencias();
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    map.set(item.codigoFabricante, item);
    setLocal(KEYS.correspondencias, [...map.values()]);
    return;
  }

  try {
    await setDoc(doc(db, 'correspondencias', item.codigoFabricante), item);
  } catch (error) {
    console.warn('Não foi possível gravar correspondência no Firebase; salvando localmente.', error);
    const atual = getLocal(KEYS.correspondencias, [] as Correspondencia[]);
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    map.set(item.codigoFabricante, item);
    setLocal(KEYS.correspondencias, [...map.values()]);
  }
}

export async function salvarHistorico(item: HistoricoComparacao) {
  if (!firebaseEnabled || !db) {
    const atual = getLocal(KEYS.historico, [] as HistoricoComparacao[]);
    const map = new Map(atual.map(x => [x.id, x]));
    map.set(item.id, item);
    setLocal(KEYS.historico, [...map.values()].sort((a,b)=>b.dataHora.localeCompare(a.dataHora)).slice(0, 5000));
    return;
  }

  try {
    await setDoc(doc(db, 'historico_comparacoes', item.id), item);
  } catch (error) {
    console.warn('Não foi possível gravar o extrato no Firebase; salvando localmente.', error);
    const atual = getLocal(KEYS.historico, [] as HistoricoComparacao[]);
    const map = new Map(atual.map(x => [x.id, x]));
    map.set(item.id, item);
    setLocal(KEYS.historico, [...map.values()].sort((a,b)=>b.dataHora.localeCompare(a.dataHora)).slice(0, 5000));
  }
}
