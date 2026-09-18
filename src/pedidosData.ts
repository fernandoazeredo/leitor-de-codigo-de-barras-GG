import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { PedidoConferencia } from './conferenciaPedidosModel';

const KEY='gg_pedidos_conferencia_v1';

function getLocal():PedidoConferencia[]{
  try{return JSON.parse(localStorage.getItem(KEY)||'[]') as PedidoConferencia[];}catch{return [];}
}
function setLocal(rows:PedidoConferencia[]){localStorage.setItem(KEY,JSON.stringify(rows));}

export async function listarPedidosConferencia():Promise<PedidoConferencia[]>{
  if(!firebaseEnabled||!db) return getLocal();
  try{
    const snap=await getDocs(collection(db,'pedidos_conferencia'));
    const rows=snap.docs.map(d=>d.data() as PedidoConferencia).sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm));
    setLocal(rows);
    return rows;
  }catch(error){
    console.warn('Não foi possível carregar pedidos do Firebase; usando cache local.',error);
    return getLocal();
  }
}

export async function salvarPedidoConferencia(item:PedidoConferencia){
  const local=getLocal();
  const map=new Map(local.map(x=>[x.id,x]));
  map.set(item.id,item);
  setLocal([...map.values()].sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm)));

  if(!firebaseEnabled||!db) return;
  try{
    await setDoc(doc(db,'pedidos_conferencia',item.id),item);
  }catch(error){
    console.warn('Não foi possível salvar pedido no Firebase; registro mantido localmente.',error);
  }
}
