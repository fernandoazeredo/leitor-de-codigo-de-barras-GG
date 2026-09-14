import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from './firebase';
import { baseGGOficial } from './baseGGOficial';
import type { Correspondencia, HistoricoComparacao, ProdutoFabricante, ProdutoGG } from './types';

const KEYS = {
  fabricantes: 'gg_fabricantes',
  produtos: 'gg_produtos',
  correspondencias: 'gg_correspondencias',
  historico: 'gg_historico_comparacoes',
};

const ADMIN_EMAILS = new Set([
  'fernandoazeredo64@gmail.com',
  'cassyomattos@gmail.com'
]);

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
function ordenarHistorico(rows:HistoricoComparacao[]){return rows.sort((a,b)=>b.dataHora.localeCompare(a.dataHora));}

function exigirFirebase(){
  if(!firebaseEnabled || !db) throw new Error('A base compartilhada do Firebase está indisponível. Nenhuma alteração foi salva.');
}

export async function listarFabricantes(): Promise<ProdutoFabricante[]> {
  if(!firebaseEnabled||!db) return getLocal(KEYS.fabricantes,demoFabricantes);
  const snap=await getDocs(collection(db,'produtos_fabricantes'));
  return snap.docs.map(d=>d.data() as ProdutoFabricante);
}

export async function listarProdutosGG(): Promise<ProdutoGG[]> {
  if(!firebaseEnabled||!db) return getLocal(KEYS.produtos,demoGG);
  const snap=await getDocs(collection(db,'produtos_gg'));
  const rows=snap.docs.map(d=>d.data() as ProdutoGG);
  const email=auth.currentUser?.email?.toLowerCase()??'';
  const admin=ADMIN_EMAILS.has(email);
  const cocaOk=rows.some(x=>x.codigoManual==='16'&&x.codigoAutomatico==='2553317150145'&&x.produto==='COCA COLA COMUM LATA 350ml C12');
  if(admin&&(rows.length!==baseGGOficial.length||!cocaOk)){
    await salvarProdutosGG(baseGGOficial,true);
    return baseGGOficial;
  }
  return rows;
}

export async function listarCorrespondencias(): Promise<Correspondencia[]> {
  if(!firebaseEnabled||!db) return getLocal(KEYS.correspondencias,[] as Correspondencia[]);
  const snap=await getDocs(collection(db,'correspondencias'));
  return snap.docs.map(d=>d.data() as Correspondencia);
}

export async function listarHistorico(): Promise<HistoricoComparacao[]> {
  if(!firebaseEnabled||!db) return ordenarHistorico(getLocal(KEYS.historico,[] as HistoricoComparacao[]));
  const snap=await getDocs(collection(db,'historico_comparacoes'));
  return ordenarHistorico(snap.docs.map(d=>d.data() as HistoricoComparacao));
}

export function assinarHistorico(onChange:(rows:HistoricoComparacao[])=>void,onError?:(error:Error)=>void){
  if(!firebaseEnabled||!db){
    onChange(ordenarHistorico(getLocal(KEYS.historico,[] as HistoricoComparacao[])));
    return ()=>undefined;
  }
  return onSnapshot(collection(db,'historico_comparacoes'),snap=>{
    const rows=ordenarHistorico(snap.docs.map(d=>d.data() as HistoricoComparacao));
    setLocal(KEYS.historico,rows.slice(0,5000));
    onChange(rows);
  },error=>onError?.(error));
}

export async function salvarFabricantes(rows: ProdutoFabricante[], substituir = false) {
  if(!firebaseEnabled||!db){
    const atual=substituir?[]:getLocal(KEYS.fabricantes,demoFabricantes);
    const map=new Map(atual.map(x=>[x.codigoFabricante,x]));rows.forEach(x=>map.set(x.codigoFabricante,x));setLocal(KEYS.fabricantes,[...map.values()]);return;
  }
  exigirFirebase();
  if(substituir){const atuais=await getDocs(collection(db,'produtos_fabricantes'));await Promise.all(atuais.docs.map(x=>deleteDoc(doc(db,'produtos_fabricantes',x.id))));}
  await Promise.all(rows.map(x=>setDoc(doc(db,'produtos_fabricantes',x.codigoFabricante),x)));
}

export async function salvarProdutosGG(rows: ProdutoGG[], substituir = false) {
  if(!firebaseEnabled||!db){
    const atual=substituir?[]:getLocal(KEYS.produtos,demoGG);const map=new Map(atual.map(x=>[x.id,x]));rows.forEach(x=>map.set(x.id,x));setLocal(KEYS.produtos,[...map.values()]);return;
  }
  exigirFirebase();
  if(substituir){const atuais=await getDocs(collection(db,'produtos_gg'));await Promise.all(atuais.docs.map(x=>deleteDoc(doc(db,'produtos_gg',x.id))));}
  await Promise.all(rows.map(x=>setDoc(doc(db,'produtos_gg',x.id),x)));
}

export async function salvarCorrespondencia(item: Correspondencia) {
  if(!firebaseEnabled||!db){const atual=getLocal(KEYS.correspondencias,[] as Correspondencia[]);const map=new Map(atual.map(x=>[x.codigoFabricante,x]));map.set(item.codigoFabricante,item);setLocal(KEYS.correspondencias,[...map.values()]);return;}
  exigirFirebase();
  await setDoc(doc(db,'correspondencias',item.codigoFabricante),item);
}

export async function salvarHistorico(item: HistoricoComparacao) {
  if(!firebaseEnabled||!db){const atual=getLocal(KEYS.historico,[] as HistoricoComparacao[]);const map=new Map(atual.map(x=>[x.id,x]));map.set(item.id,item);setLocal(KEYS.historico,ordenarHistorico([...map.values()]).slice(0,5000));return;}
  exigirFirebase();
  await setDoc(doc(db,'historico_comparacoes',item.id),item);
}
