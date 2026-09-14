import { useEffect, useMemo, useState } from 'react';
import { Scanner } from './Scanner';
import { listarCorrespondencias, listarProdutosGG } from './data';
import { melhoresCandidatos } from './matching';
import { identificarProdutoExterno } from './produtoExterno';
import type { ProdutoFabricante, ProdutoGG } from './types';
import { listarPedidosConferencia, salvarPedidoConferencia } from './pedidosData';
import { parseNFeXml, recalcularStatus, situacaoItem, temDivergenciaReal, type DivergenciaConferencia, type PedidoConferencia } from './conferenciaPedidos';

function normalizarCodigo(v?:string){return String(v??'').trim().replace(/\D/g,'');}
const novaDivergencia=(tipo:DivergenciaConferencia['tipo'],descricao:string,codigo?:string):DivergenciaConferencia=>({id:`${tipo}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,tipo,descricao,codigo,dataHora:new Date().toISOString()});

async function compactarSelfie(file:File):Promise<string>{
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Não foi possível ler a selfie.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Imagem inválida.'));
      img.onload=()=>{
        const max=180, escala=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*escala));canvas.height=Math.max(1,Math.round(img.height*escala));
        const ctx=canvas.getContext('2d');
        if(!ctx){reject(new Error('Não foi possível processar a selfie.'));return;}
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.62));
      };
      img.src=String(reader.result||'');
    };
    reader.readAsDataURL(file);
  });
}

export function ConferenciaPedidos(){
  const [pedidos,setPedidos]=useState<PedidoConferencia[]>([]);
  const [aberto,setAberto]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false);
  const [mensagem,setMensagem]=useState('');
  const [codigo,setCodigo]=useState('');
  const [selfie,setSelfie]=useState('');
  const [arrastando,setArrastando]=useState(false);
  const [carregando,setCarregando]=useState(true);

  useEffect(()=>{void listarPedidosConferencia().then(setPedidos).finally(()=>setCarregando(false));},[]);
  const pedido=useMemo(()=>pedidos.find(p=>p.id===aberto)||null,[pedidos,aberto]);

  async function persistOne(item:PedidoConferencia){
    const novo={...item,status:recalcularStatus(item),atualizadoEm:new Date().toISOString()};
    setPedidos(atual=>{const map=new Map(atual.map(x=>[x.id,x]));map.set(novo.id,novo);return [...map.values()].sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm));});
    await salvarPedidoConferencia(novo);
  }

  async function importarArquivos(files:FileList|File[]){
    const xmls=Array.from(files).filter(f=>f.name.toLowerCase().endsWith('.xml'));
    if(!xmls.length){setMensagem('Arraste somente arquivos XML de NF-e.');return;}
    let criados=0,duplicados=0,erros=0;
    const atuais=await listarPedidosConferencia();const ids=new Set(atuais.map(p=>p.id));const novos:PedidoConferencia[]=[];
    for(const file of xmls){try{const novo=parseNFeXml(await file.text(),file.name);if(ids.has(novo.id)){duplicados++;continue;}ids.add(novo.id);novos.push(novo);await salvarPedidoConferencia(novo);criados++;}catch{erros++;}}
    if(novos.length)setPedidos([...novos,...atuais].sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm)));
    setMensagem([`${criados} card(s) criado(s)`,duplicados?`${duplicados} NF(s) já existente(s)`:null,erros?`${erros} arquivo(s) com erro`:null].filter(Boolean).join(' · '));
  }

  async function identificarNaBase(codigoLido:string){
    const c=normalizarCodigo(codigoLido);const [corrs,ggs]=await Promise.all([listarCorrespondencias(),listarProdutosGG()]);
    const corr=corrs.find(x=>[x.codigoFabricante,x.codigoAutomatico,x.codigoManual].some(v=>normalizarCodigo(v)===c));
    if(corr)return {descricao:corr.produtoGG,ean:normalizarCodigo(corr.codigoFabricante)};
    const gg=ggs.find(x=>[x.codigoAutomatico,x.codigoManual].some(v=>normalizarCodigo(v)===c));
    if(gg)return {descricao:gg.produto,ean:c};
    if(!/^\d{8,14}$/.test(c))return null;
    const ext=await identificarProdutoExterno(c);return ext.encontrado&&ext.produto?{descricao:ext.produto.produto,ean:c}:null;
  }

  async function conferir(cod:string){
    if(!pedido)return;const c=normalizarCodigo(cod);setCodigo('');setScanning(false);if(!c){setMensagem('Informe ou leia um código.');return;}
    const direto=pedido.itens.find(i=>normalizarCodigo(i.ean)===c||normalizarCodigo(i.codigoProduto)===c);
    if(direto){
      const itens=pedido.itens.map(i=>i.id===direto.id?{...i,conferido:i.conferido+1}:i);const atual=itens.find(i=>i.id===direto.id)!;const sit=situacaoItem(atual);
      const divergencias=[...(pedido.divergencias||[])];
      if(sit==='EXCEDENTE')divergencias.push(novaDivergencia('QUANTIDADE_MAIOR',`${direto.descricao}: NF ${direto.quantidade}, lido ${atual.conferido}`,c));
      await persistOne({...pedido,itens,divergencias,conferenciaFinalizada:false});
      setMensagem(sit==='OK'?`✅ CONFERIDO — ${direto.descricao}`:sit==='FALTANDO'?`⚠️ FALTANDO — ${direto.descricao}`:`🔺 DIVERGÊNCIA — quantidade a mais de ${direto.descricao}`);return;
    }
    const identificado=await identificarNaBase(c);
    if(!identificado){
      await persistOne({...pedido,divergencias:[...(pedido.divergencias||[]),novaDivergencia('PRODUTO_ERRADO',`Código ${c}: produto não pertence a esta NF`,c)]});
      setMensagem('🔺 DIVERGÊNCIA — produto errado ou não pertence a esta NF.');return;
    }
    const fab:ProdutoFabricante={id:c,codigoFabricante:c,produto:identificado.descricao};
    const candidatos=melhoresCandidatos(fab,pedido.itens.map((i,index)=>({id:i.id||String(index),codigoAutomatico:i.codigoProduto||'',codigoManual:i.ean,produto:i.descricao} as ProdutoGG)));
    const candidato=candidatos[0];
    if(candidato&&candidato.score>=70){const item=pedido.itens.find(i=>i.id===candidato.produto.id);if(item){setMensagem(`⚠️ ATENÇÃO — possível ${item.descricao}. Confirme pelo código correto da NF.`);return;}}
    await persistOne({...pedido,divergencias:[...(pedido.divergencias||[]),novaDivergencia('PRODUTO_ERRADO',`${identificado.descricao} não pertence a esta NF`,c)]});
    setMensagem(`🔺 DIVERGÊNCIA — ${identificado.descricao} não pertence a esta NF.`);
  }

  async function finalizarConferencia(){
    if(!pedido)return;
    const faltas=pedido.itens.filter(i=>i.conferido<i.quantidade);
    if(!faltas.length&&!pedido.itens.some(i=>i.conferido>i.quantidade)&&(pedido.divergencias?.length||0)===0){await persistOne({...pedido,conferenciaFinalizada:true});setMensagem('✅ PEDIDO CONFERIDO — liberado para carregamento.');return;}
    const existentes=pedido.divergencias||[];
    const novas=faltas.filter(i=>!existentes.some(d=>d.tipo==='QUANTIDADE_MENOR'&&d.descricao.startsWith(i.descricao))).map(i=>novaDivergencia('QUANTIDADE_MENOR',`${i.descricao}: NF ${i.quantidade}, lido ${i.conferido}`,i.ean||i.codigoProduto));
    await persistOne({...pedido,conferenciaFinalizada:true,divergencias:[...existentes,...novas]});
    setMensagem('🔺 DIVERGÊNCIA CONFIRMADA — para liberar o carregamento é necessária a selfie do responsável.');
  }

  async function removerUltimo(itemId:string){if(!pedido)return;const itens=pedido.itens.map(i=>i.id===itemId?{...i,conferido:Math.max(0,i.conferido-1)}:i);await persistOne({...pedido,itens,conferenciaFinalizada:false});}
  async function foto(file?:File){if(!file)return;try{setSelfie(await compactarSelfie(file));}catch(e){setMensagem(e instanceof Error?e.message:'Não foi possível registrar a selfie.');}}
  async function autorizar(){if(!pedido||!selfie||!temDivergenciaReal(pedido))return;await persistOne({...pedido,autorizacao:{selfie,dataHora:new Date().toISOString()}});setMensagem('🔐 LIBERADO COM AUTORIZAÇÃO');setSelfie('');}

  const totalPrevisto=pedido?.itens.reduce((s,i)=>s+i.quantidade,0)||0,totalLido=pedido?.itens.reduce((s,i)=>s+i.conferido,0)||0;
  const divergenciaReal=pedido?temDivergenciaReal(pedido):false;

  return <section className="orders-module">
    {!pedido&&<>
      <div className="section-title-row"><div><h1>Conferência de Pedidos</h1><p className="muted">Arraste as NF-e em XML. Cada nota cria um card para conferência antes do carregamento.</p></div></div>
      <label className={`xml-drop-zone ${arrastando?'dragging':''}`} onDragOver={e=>{e.preventDefault();setArrastando(true);}} onDragLeave={()=>setArrastando(false)} onDrop={e=>{e.preventDefault();setArrastando(false);void importarArquivos(e.dataTransfer.files);}}>
        <div className="drop-icon">⇩</div><b>ARRASTE AS NOTAS XML AQUI</b><span>Uma NF-e = um card de pedido</span><small>Ou clique para selecionar vários XML de uma vez</small>
        <input hidden multiple type="file" accept=".xml,application/xml,text/xml" onChange={e=>{if(e.target.files)void importarArquivos(e.target.files);e.currentTarget.value='';}}/>
      </label>
      {mensagem&&<div className="card"><b>{mensagem}</b></div>}{carregando&&<div className="card"><b>Carregando pedidos...</b></div>}
      {!carregando&&pedidos.length===0&&<div className="not-found"><b>Nenhum pedido registrado.</b><span>Arraste uma ou várias NF-e XML para criar os cards.</span></div>}
      <div className="orders-grid">{pedidos.map(p=>{const faltando=p.itens.reduce((s,i)=>s+Math.max(0,i.quantidade-i.conferido),0);return <button className={`order-card status-${p.status.toLowerCase()}`} key={p.id} onClick={()=>{setAberto(p.id);setMensagem('');}}><div className="order-card-head"><strong>NF {p.numeroNF}</strong><span>{p.status==='CONFERIDO'?'✅':p.status==='LIBERADO_AUTORIZACAO'?'🔐':p.status==='DIVERGENCIA'?'🔺':'⚠️'}</span></div><b>{p.cliente}</b><small>{p.itens.length} itens · {faltando>0?`${faltando} pendente(s)`:'quantidades completas'}</small><small>{p.status.replace(/_/g,' ')}</small>{p.autorizacao&&<div className="auth-mini-row"><img className="auth-selfie-mini" src={p.autorizacao.selfie} alt="Autorização"/><span>Liberado com autorização</span></div>}</button>;})}</div>
    </>}

    {pedido&&<>
      <button onClick={()=>{setAberto(null);setScanning(false);setMensagem('');}}>← Voltar aos cards</button>
      <div className="card order-summary"><div className="order-card-head"><div><h2>NF {pedido.numeroNF}</h2><b>{pedido.cliente}</b></div><span className="big-status">{pedido.status==='CONFERIDO'?'✅':pedido.status==='LIBERADO_AUTORIZACAO'?'🔐':pedido.status==='DIVERGENCIA'?'🔺':'⚠️'}</span></div><div className="progress-line"><b>{totalLido}</b> / {totalPrevisto} unidades conferidas</div></div>
      <div className="search"><input value={codigo} onChange={e=>setCodigo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void conferir(codigo);}} placeholder="EAN/GTIN ou código do item"/><button className="primary" onClick={()=>void conferir(codigo)}>Conferir</button></div>
      <button className="primary wide" onClick={()=>setScanning(v=>!v)}>{scanning?'Fechar câmera':'Abrir câmera'}</button>{scanning&&<Scanner onCode={c=>void conferir(c)}/>}      
      {mensagem&&<div className="card scan-feedback"><b>{mensagem}</b></div>}
      <div className="order-items">{pedido.itens.map(item=>{const sit=situacaoItem(item);return <div className={`card order-item item-${sit.toLowerCase()}`} key={item.id}><div className="order-card-head"><b>{item.descricao}</b><span className="item-icon">{sit==='OK'?'✅':sit==='FALTANDO'?'⚠️':'🔺'}</span></div><div className="item-qty"><span>NF: <b>{item.quantidade}</b></span><span>Lido: <b>{item.conferido}</b></span></div><small>{sit==='OK'?'CONFERIDO':sit==='FALTANDO'?`FALTAM ${Math.max(0,item.quantidade-item.conferido)}`:`DIVERGÊNCIA · EXCEDENTE ${item.conferido-item.quantidade}`}</small>{item.conferido>0&&<button className="mini-link" onClick={()=>void removerUltimo(item.id)}>Desfazer 1 leitura</button>}</div>;})}</div>
      {pedido.status!=='CONFERIDO'&&pedido.status!=='LIBERADO_AUTORIZACAO'&&<button className="wide" onClick={()=>void finalizarConferencia()}>Finalizar conferência</button>}
      {divergenciaReal&&pedido.status!=='LIBERADO_AUTORIZACAO'&&<div className="card authorization-card"><h3>🔺 Divergência — autorização necessária</h3><p className="muted">Somente para produto errado ou quantidade a mais/a menos. Abra a câmera e tire a selfie do responsável que autorizou o carregamento.</p><label className="button">📷 Abrir câmera — autorizado por<input hidden type="file" accept="image/*" capture="user" onChange={e=>void foto(e.target.files?.[0])}/></label>{selfie&&<img className="auth-selfie-preview" src={selfie} alt="Prévia da autorização"/>}<button className="primary wide" disabled={!selfie} onClick={()=>void autorizar()}>Confirmar autorização</button></div>}
      {pedido.divergencias&&pedido.divergencias.length>0&&<div className="card"><h3>Registro de divergências</h3>{pedido.divergencias.map(d=><small key={d.id} style={{display:'block',margin:'6px 0'}}>🔺 {d.descricao}</small>)}</div>}
      {pedido.autorizacao&&<div className="card authorized-order"><div className="order-card-head"><b>🔐 LIBERADO COM AUTORIZAÇÃO</b><img className="auth-selfie-mini" src={pedido.autorizacao.selfie} alt="Autorização"/></div><small>{new Date(pedido.autorizacao.dataHora).toLocaleString('pt-BR')}</small></div>}
    </>}
  </section>;
}
