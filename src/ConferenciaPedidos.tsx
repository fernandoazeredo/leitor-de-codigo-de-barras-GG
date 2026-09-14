import { useMemo, useState } from 'react';
import { Scanner } from './Scanner';
import { listarCorrespondencias, listarProdutosGG } from './data';
import { melhoresCandidatos } from './matching';
import { identificarProdutoExterno } from './produtoExterno';
import type { ProdutoFabricante, ProdutoGG } from './types';
import { parseNFeXml, recalcularStatus, situacaoItem, type PedidoConferencia } from './conferenciaPedidos';

const KEY='gg_pedidos_conferencia_v1';

function carregar():PedidoConferencia[]{
  try{return JSON.parse(localStorage.getItem(KEY)||'[]') as PedidoConferencia[];}catch{return [];}
}
function salvar(rows:PedidoConferencia[]){localStorage.setItem(KEY,JSON.stringify(rows));}
function normalizarCodigo(v?:string){return String(v??'').trim().replace(/\D/g,'');}

export function ConferenciaPedidos(){
  const [pedidos,setPedidos]=useState<PedidoConferencia[]>(carregar);
  const [aberto,setAberto]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false);
  const [mensagem,setMensagem]=useState('');
  const [codigo,setCodigo]=useState('');
  const [selfie,setSelfie]=useState<string>('');

  const pedido=useMemo(()=>pedidos.find(p=>p.id===aberto)||null,[pedidos,aberto]);

  function persist(next:PedidoConferencia[]){setPedidos(next);salvar(next);}
  function atualizar(p:PedidoConferencia){
    const novo={...p,status:recalcularStatus(p),atualizadoEm:new Date().toISOString()};
    persist(pedidos.map(x=>x.id===novo.id?novo:x));
  }

  async function importar(file?:File){
    if(!file)return;
    try{
      const nome=file.name.toLowerCase();
      if(nome.endsWith('.xml')){
        const pedidoNovo=parseNFeXml(await file.text(),file.name);
        if(pedidos.some(p=>p.id===pedidoNovo.id)) throw new Error('Esta NF-e já foi importada.');
        persist([pedidoNovo,...pedidos]);
        setMensagem(`NF ${pedidoNovo.numeroNF} importada com sucesso.`);
      }else if(nome.endsWith('.pdf')){
        setMensagem('PDF recebido. Nesta primeira versão, a leitura estruturada automática está disponível para XML. O PDF será tratado como alternativa em uma próxima etapa.');
      }else throw new Error('Envie um arquivo XML ou PDF.');
    }catch(e){setMensagem(e instanceof Error?e.message:'Não foi possível importar o arquivo.');}
  }

  async function identificarNaBase(codigoLido:string){
    const c=normalizarCodigo(codigoLido);
    const [corrs,ggs]=await Promise.all([listarCorrespondencias(),listarProdutosGG()]);
    const corr=corrs.find(x=>normalizarCodigo(x.codigoFabricante)===c || normalizarCodigo(x.codigoAutomatico)===c || normalizarCodigo(x.codigoManual)===c);
    if(corr) return {descricao:corr.produtoGG,ean:normalizarCodigo(corr.codigoFabricante)};
    const gg=ggs.find(x=>normalizarCodigo(x.codigoAutomatico)===c || normalizarCodigo(x.codigoManual)===c);
    if(gg) return {descricao:gg.produto,ean:c};
    if(!/^\d{8,14}$/.test(c)) return null;
    const ext=await identificarProdutoExterno(c);
    if(!ext.encontrado||!ext.produto) return null;
    return {descricao:ext.produto.produto,ean:c};
  }

  async function conferir(cod:string){
    if(!pedido)return;
    const c=normalizarCodigo(cod);
    setCodigo(c);
    setScanning(false);
    if(!c){setMensagem('Informe ou leia um código.');return;}

    const direto=pedido.itens.find(i=>normalizarCodigo(i.ean)===c || normalizarCodigo(i.codigoProduto)===c);
    if(direto){
      const itens=pedido.itens.map(i=>i.id===direto.id?{...i,conferido:i.conferido+1}:i);
      atualizar({...pedido,itens,status:'EM_CONFERENCIA'});
      const sit=situacaoItem(itens.find(i=>i.id===direto.id)!);
      setMensagem(sit==='OK'?`✅ ${direto.descricao}: conferido.`:sit==='FALTANDO'?`⚠️ ${direto.descricao}: ainda falta quantidade.`:`🔺 ${direto.descricao}: quantidade excedida.`);
      return;
    }

    const identificado=await identificarNaBase(c);
    if(!identificado){setMensagem('🔺 DIVERGÊNCIA: produto não identificado e não localizado nesta NF.');return;}

    const fab:ProdutoFabricante={id:c,codigoFabricante:c,produto:identificado.descricao};
    const candidatos=melhoresCandidatos(fab,pedido.itens.map((i,index)=>({id:i.id||String(index),codigoAutomatico:i.codigoProduto||'',codigoManual:i.ean,produto:i.descricao} as ProdutoGG)));
    const candidato=candidatos[0];
    if(candidato && candidato.score>=70){
      const item=pedido.itens.find(i=>i.id===candidato.produto.id);
      if(item){
        const itens=pedido.itens.map(i=>i.id===item.id?{...i,conferido:i.conferido+1}:i);
        atualizar({...pedido,itens,status:'EM_CONFERENCIA'});
        setMensagem(`⚠️ Código associado por semelhança a ${item.descricao}. Confira visualmente.`);
        return;
      }
    }
    setMensagem(`🔺 DIVERGÊNCIA: ${identificado.descricao} não pertence a esta NF.`);
  }

  function removerUltimo(itemId:string){
    if(!pedido)return;
    const itens=pedido.itens.map(i=>i.id===itemId?{...i,conferido:Math.max(0,i.conferido-1)}:i);
    atualizar({...pedido,itens});
  }

  function foto(file?:File){
    if(!file)return;
    const r=new FileReader();
    r.onload=()=>setSelfie(String(r.result||''));
    r.readAsDataURL(file);
  }

  function autorizar(){
    if(!pedido||!selfie)return;
    atualizar({...pedido,autorizacao:{selfie,dataHora:new Date().toISOString()}});
    setMensagem('🔐 Divergência liberada com autorização visual.');
    setSelfie('');
  }

  const totalPrevisto=pedido?.itens.reduce((s,i)=>s+i.quantidade,0)||0;
  const totalLido=pedido?.itens.reduce((s,i)=>s+i.conferido,0)||0;

  return <section className="orders-module">
    {!pedido&&<>
      <div className="section-title-row"><div><h1>Conferência de Pedidos</h1><p className="muted">Conferência antes do carregamento no caminhão.</p></div></div>
      <label className="button primary">Importar NF XML/PDF<input hidden type="file" accept=".xml,.pdf,application/xml,application/pdf" onChange={e=>void importar(e.target.files?.[0])}/></label>
      {mensagem&&<div className="card"><b>{mensagem}</b></div>}
      {pedidos.length===0&&<div className="not-found"><b>Nenhum pedido importado.</b><span>Envie a NF de venda para criar o card de conferência.</span></div>}
      <div className="orders-grid">{pedidos.map(p=><button className={`order-card status-${p.status.toLowerCase()}`} key={p.id} onClick={()=>{setAberto(p.id);setMensagem('');}}>
        <div className="order-card-head"><strong>NF {p.numeroNF}</strong><span>{p.status==='CONFERIDO'?'✅':p.status==='DIVERGENCIA'?'🔺':p.status==='LIBERADO_AUTORIZACAO'?'🔐':'⚠️'}</span></div>
        <b>{p.cliente}</b><small>{p.itens.length} itens</small><small>{p.arquivoNome}</small>
        {p.autorizacao&&<img className="auth-selfie-mini" src={p.autorizacao.selfie} alt="Autorização"/>}
      </button>)}</div>
    </>}

    {pedido&&<>
      <button onClick={()=>{setAberto(null);setScanning(false);setMensagem('');}}>← Voltar aos pedidos</button>
      <div className="card order-summary">
        <div className="order-card-head"><div><h2>NF {pedido.numeroNF}</h2><b>{pedido.cliente}</b></div><span className="big-status">{pedido.status==='CONFERIDO'?'✅':pedido.status==='DIVERGENCIA'?'🔺':pedido.status==='LIBERADO_AUTORIZACAO'?'🔐':'⚠️'}</span></div>
        <div className="progress-line"><b>{totalLido}</b> / {totalPrevisto} unidades conferidas</div>
      </div>

      <div className="search"><input value={codigo} onChange={e=>setCodigo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void conferir(codigo);}} placeholder="EAN/GTIN ou código do item"/><button className="primary" onClick={()=>void conferir(codigo)}>Conferir</button></div>
      <button className="primary wide" onClick={()=>setScanning(v=>!v)}>{scanning?'Fechar câmera':'Abrir câmera'}</button>
      {scanning&&<Scanner onCode={c=>void conferir(c)}/>}      
      {mensagem&&<div className="card scan-feedback"><b>{mensagem}</b></div>}

      <div className="order-items">{pedido.itens.map(item=>{
        const sit=situacaoItem(item);
        return <div className={`card order-item item-${sit.toLowerCase()}`} key={item.id}>
          <div className="order-card-head"><b>{item.descricao}</b><span className="item-icon">{sit==='OK'?'✅':sit==='FALTANDO'?'⚠️':'🔺'}</span></div>
          <div className="item-qty"><span>NF: <b>{item.quantidade}</b></span><span>Lido: <b>{item.conferido}</b></span></div>
          <small>{sit==='OK'?'CONFERIDO':sit==='FALTANDO'?`FALTAM ${Math.max(0,item.quantidade-item.conferido)}`:`EXCEDENTE ${item.conferido-item.quantidade}`}</small>
          {item.conferido>0&&<button className="mini-link" onClick={()=>removerUltimo(item.id)}>Desfazer 1 leitura</button>}
        </div>;
      })}</div>

      {pedido.status!=='CONFERIDO'&&<div className="card authorization-card">
        <h3>Liberação com divergência</h3>
        <p className="muted">Use somente quando um responsável autorizar o carregamento mesmo com falta, incompleto ou divergência.</p>
        <label className="button">Tirar selfie da autorização<input hidden type="file" accept="image/*" capture="user" onChange={e=>foto(e.target.files?.[0])}/></label>
        {selfie&&<img className="auth-selfie-preview" src={selfie} alt="Prévia da autorização"/>}
        <button className="primary wide" disabled={!selfie} onClick={autorizar}>Liberar com autorização</button>
      </div>}
      {pedido.autorizacao&&<div className="card authorized-order"><div className="order-card-head"><b>🔐 LIBERADO COM AUTORIZAÇÃO</b><img className="auth-selfie-mini" src={pedido.autorizacao.selfie} alt="Autorização"/></div><small>{new Date(pedido.autorizacao.dataHora).toLocaleString('pt-BR')}</small></div>}
    </>}
  </section>;
}
