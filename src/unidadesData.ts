import { collection, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { ProdutoUnidade } from './unidadesBebidas';

export interface FatorProduto extends ProdutoUnidade {
  id:string;
  produtoNome:string;
  codigo?:string;
  atualizadoEm:string;
}

const KEY='gg_fatores_produto_v1';
const idFator=(produtoId:string,unidade:string)=>`${produtoId}__${unidade}`.replace(/[^a-zA-Z0-9_-]/g,'_');

function local():FatorProduto[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]') as FatorProduto[];}catch{return[];}}
function salvarLocal(rows:FatorProduto[]){localStorage.setItem(KEY,JSON.stringify(rows));}

export async function listarFatoresProduto():Promise<FatorProduto[]>{
  if(!firebaseEnabled||!db)return local();
  const snap=await getDocs(collection(db,'produto_unidades'));
  const rows=snap.docs.map(d=>d.data() as FatorProduto);
  salvarLocal(rows);return rows;
}

export function assinarFatoresProduto(onChange:(rows:FatorProduto[])=>void,onError?:(error:Error)=>void){
  if(!firebaseEnabled||!db){onChange(local());return()=>undefined;}
  return onSnapshot(collection(db,'produto_unidades'),snap=>{const rows=snap.docs.map(d=>d.data() as FatorProduto);salvarLocal(rows);onChange(rows);},e=>onError?.(e));
}

export async function salvarFatorProduto(p:{produtoId:string;produtoNome:string;unidade:string;fatorConversao:number;codigo?:string}){
  if(!Number.isFinite(p.fatorConversao)||p.fatorConversao<=0)throw new Error('O fator deve ser maior que zero.');
  const item:FatorProduto={...p,id:idFator(p.produtoId,p.unidade),atualizadoEm:new Date().toISOString()};
  if(!firebaseEnabled||!db){const m=new Map(local().map(x=>[x.id,x]));m.set(item.id,item);salvarLocal([...m.values()]);return item;}
  await setDoc(doc(db,'produto_unidades',item.id),item);
  return item;
}
