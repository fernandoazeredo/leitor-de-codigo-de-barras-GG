import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { PedidoConferencia } from './conferenciaPedidosModel';

const KEY='gg_pedidos_conferencia_v1';

function getLocal():PedidoConferencia[]{
  try{return JSON.parse(localStorage.getItem(KEY)||'[]') as PedidoConferencia[];}catch{return [];}
}
function setLocal(rows:PedidoConferencia[]){localStorage.setItem(KEY,JSON.stringify(rows));}
function ordenar(rows:PedidoConferencia[]){return rows.sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm));}

export async function listarPedidosConferencia():Promise<PedidoConferencia[]>{
  if(!firebaseEnabled||!db) return getLocal();
  const snap=await getDocs(collection(db,'pedidos_conferencia'));
  const rows=ordenar(snap.docs.map(d=>d.data() as PedidoConferencia));
  setLocal(rows);
  return rows;
}

export function assinarPedidosConferencia(onChange:(rows:PedidoConferencia[])=>void,onError?:(error:Error)=>void){
  if(!firebaseEnabled||!db){
    onChange(getLocal());
    return ()=>undefined;
  }
  return onSnapshot(collection(db,'pedidos_conferencia'),snap=>{
    const rows=ordenar(snap.docs.map(d=>d.data() as PedidoConferencia));
    setLocal(rows);
    onChange(rows);
  },error=>onError?.(error));
}

export async function salvarPedidoConferencia(item:PedidoConferencia){
  if(!firebaseEnabled||!db){
    const local=getLocal();
    const map=new Map(local.map(x=>[x.id,x]));
    map.set(item.id,item);
    setLocal(ordenar([...map.values()]));
    return;
  }
  await setDoc(doc(db,'pedidos_conferencia',item.id),item);
}

export async function excluirPedidoConferencia(id:string){
  if(!firebaseEnabled||!db){
    setLocal(getLocal().filter(item=>item.id!==id));
    return;
  }
  await deleteDoc(doc(db,'pedidos_conferencia',id));
  setLocal(getLocal().filter(item=>item.id!==id));
}
