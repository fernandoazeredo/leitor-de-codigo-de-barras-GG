import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

const KEYS = {
  fabricantes: 'gg_fabricantes',
  produtos: 'gg_produtos',
  correspondencias: 'gg_correspondencias',
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

export async function listarFabricantes(): Promise<ProdutoFabricante[]> {
  if (!firebaseEnabled || !db) return getLocal(KEYS.fabricantes, demoFabricantes);
  const snap = await getDocs(collection(db, 'produtos_fabricantes'));
  return snap.docs.map(d => d.data() as ProdutoFabricante);
}
export async function listarProdutosGG(): Promise<ProdutoGG[]> {
  if (!firebaseEnabled || !db) return getLocal(KEYS.produtos, demoGG);
  const snap = await getDocs(collection(db, 'produtos_gg'));
  return snap.docs.map(d => d.data() as ProdutoGG);
}
export async function listarCorrespondencias(): Promise<Correspondencia[]> {
  if (!firebaseEnabled || !db) return getLocal(KEYS.correspondencias, [] as Correspondencia[]);
  const snap = await getDocs(collection(db, 'correspondencias'));
  return snap.docs.map(d => d.data() as Correspondencia);
}

export async function salvarFabricantes(rows: ProdutoFabricante[], substituir = false) {
  if (!firebaseEnabled || !db) {
    const atual = substituir ? [] : await listarFabricantes();
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    rows.forEach(x => map.set(x.codigoFabricante, x));
    setLocal(KEYS.fabricantes, [...map.values()]);
    return;
  }
  if (substituir) {
    const atuais = await getDocs(collection(db, 'produtos_fabricantes'));
    await Promise.all(atuais.docs.map(x => deleteDoc(doc(db, 'produtos_fabricantes', x.id))));
  }
  await Promise.all(rows.map(x => setDoc(doc(db, 'produtos_fabricantes', x.codigoFabricante), x)));
}

export async function salvarProdutosGG(rows: ProdutoGG[], substituir = false) {
  if (!firebaseEnabled || !db) {
    const atual = substituir ? [] : await listarProdutosGG();
    const map = new Map(atual.map(x => [x.codigoAutomatico, x]));
    rows.forEach(x => map.set(x.codigoAutomatico, x));
    setLocal(KEYS.produtos, [...map.values()]);
    return;
  }
  if (substituir) {
    const atuais = await getDocs(collection(db, 'produtos_gg'));
    await Promise.all(atuais.docs.map(x => deleteDoc(doc(db, 'produtos_gg', x.id))));
  }
  await Promise.all(rows.map(x => setDoc(doc(db, 'produtos_gg', x.codigoAutomatico), x)));
}

export async function salvarCorrespondencia(item: Correspondencia) {
  if (!firebaseEnabled || !db) {
    const atual = await listarCorrespondencias();
    const map = new Map(atual.map(x => [x.codigoFabricante, x]));
    map.set(item.codigoFabricante, item);
    setLocal(KEYS.correspondencias, [...map.values()]);
    return;
  }
  await setDoc(doc(db, 'correspondencias', item.codigoFabricante), item);
}
