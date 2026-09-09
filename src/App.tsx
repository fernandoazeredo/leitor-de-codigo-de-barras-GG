import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scanner } from './Scanner';
import { BrandMark } from './BrandMark';
import { auth } from './firebase';
import {
  listarCorrespondencias,
  listarFabricantes,
  listarHistorico,
  listarProdutosGG,
  salvarCorrespondencia,
  salvarFabricantes,
  salvarHistorico,
  salvarProdutosGG
} from './data';
import {
  exportarConsolidado,
  exportarExtrato,
  exportarFabricantes,
  exportarGGAutomatico,
  exportarGGManual,
  importarFabricantes,
  importarGGAutomatico,
  importarGGManual,
  modeloFabricantes,
  modeloGGAutomatico,
  modeloGGManual
} from './excel';
import { melhoresCandidatos, normalizar } from './matching';
import type { Correspondencia, HistoricoComparacao, ProdutoFabricante, ProdutoGG } from './types';

type Aba = 'leitor'|'fabricantes'|'gg'|'correspondencias'|'extrato';
type TipoPlanilha = 'fab'|'gg-manual'|'gg-auto';

type ResultadoBusca = {
  fab?: ProdutoFabricante;
  corr?: Correspondencia;
  candidatos?: ReturnType<typeof melhoresCandidatos>;
  jaExistia?: boolean;
};

const chaveProduto = (s:string) => normalizar(s);
const idExtrato = (codigoFabricante:string) => `corr-${codigoFabricante}`;

export default function App() {
  const [aba,setAba]=useState<Aba>('leitor');
  const [fabricantes,setFabricantes]=useState<ProdutoFabricante[]>([]);
  const [produtosGG,setProdutosGG]=useState<ProdutoGG[]>([]);
  const [corrs,setCorrs]=useState<Correspondencia[]>([]);
  const [historico,setHistorico]=useState<HistoricoComparacao[]>([]);
  const [busca,setBusca]=useState('');
  const [scanning,setScanning]=useState(false);
  const [planilhasOpen,setPlanilhasOpen]=useState(false);
  const [resultado,setResultado]=useState<ResultadoBusca|null>(null);
  const [extratoBusca,setExtratoBusca]=useState('');
  const [extratoFiltro,setExtratoFiltro]=useState('');
  const [destacarExtrato,setDestacarExtrato]=useState<string|null>(null);

  async function recarregar(){
    const [f,g,c,h]=await Promise.all([
      listarFabricantes(),
      listarProdutosGG(),
      listarCorrespondencias(),
      listarHistorico()
    ]);
    setFabricantes(f);
    setProdutosGG(g);
    setCorrs(c);
    setHistorico(h);
  }

  useEffect(()=>{void recarregar();},[]);

  useEffect(()=>{
    if(!planilhasOpen) return;

    const fecharFora=(event:PointerEvent)=>{
      const alvo=event.target as Node | null;
      const menu=document.querySelector('.sheet-menu-wrap');
      if(alvo && menu && !menu.contains(alvo)) setPlanilhasOpen(false);
    };
    const fecharEsc=(event:KeyboardEvent)=>{
      if(event.key==='Escape') setPlanilhasOpen(false);
    };

    document.addEventListener('pointerdown',fecharFora);
    document.addEventListener('keydown',fecharEsc);
    return ()=>{
      document.removeEventListener('pointerdown',fecharFora);
      document.removeEventListener('keydown',fecharEsc);
    };
  },[planilhasOpen]);

  useEffect(()=>{
    if(aba!=='extrato' || !destacarExtrato) return;
    const timer=window.setTimeout(()=>{
      document.getElementById(`extrato-${destacarExtrato}`)?.scrollIntoView({behavior:'smooth',block:'center'});
    },120);
    return ()=>window.clearTimeout(timer);
  },[aba,destacarExtrato,historico]);

  const criarItemExtrato = useCallback((corr:Correspondencia,codigoPesquisado:string,dataHora?:string):HistoricoComparacao => ({
    id:idExtrato(corr.codigoFabricante),
    tipo:'VINCULO_CRIADO',
    dataHora:dataHora ?? new Date().toISOString(),
    codigoPesquisado:codigoPesquisado || corr.codigoFabricante,
    codigoFabricante:corr.codigoFabricante,
    codigoAutomatico:corr.codigoAutomatico,
    codigoManual:corr.codigoManual,
    produtoFabricante:corr.produtoFabricante,
    produtoGG:corr.produtoGG,
    score:corr.score,
    usuario:auth.currentUser?.email ?? undefined
  }),[]);

  const garantirNoExtrato = useCallback(async (corr:Correspondencia,codigoPesquisado:string) => {
    const id=idExtrato(corr.codigoFabricante);
    const existente=historico.find(x=>x.id===id || x.codigoFabricante===corr.codigoFabricante);
    if(existente) return existente;

    const item=criarItemExtrato(corr,codigoPesquisado);
    await salvarHistorico(item);
    setHistorico(atual=>[item,...atual.filter(x=>x.id!==item.id)]);
    return item;
  },[historico,criarItemExtrato]);

  const resolver = useCallback(async (codigo:string) => {
    const c=codigo.trim();
    setBusca(c);
    setScanning(false);
    setDestacarExtrato(null);

    if(!c){setResultado(null);return;}

    const corr=corrs.find(x=>x.codigoFabricante===c || x.codigoAutomatico===c || x.codigoManual===c);
    if(corr){
      const registro=await garantirNoExtrato(corr,c);
      setDestacarExtrato(registro.id);
      setResultado({fab:fabricantes.find(x=>x.codigoFabricante===corr.codigoFabricante),corr,jaExistia:true});
      return;
    }

    const fab=fabricantes.find(x=>x.codigoFabricante===c);
    if(fab){
      setResultado({fab,candidatos:melhoresCandidatos(fab,produtosGG)});
      return;
    }

    const gg=produtosGG.find(x=>x.codigoAutomatico===c || x.codigoManual===c);
    if(gg){
      const achada=corrs.find(x=>x.produtoGGId===gg.id || (gg.codigoAutomatico && x.codigoAutomatico===gg.codigoAutomatico) || (gg.codigoManual && x.codigoManual===gg.codigoManual));
      if(achada){
        const registro=await garantirNoExtrato(achada,c);
        setDestacarExtrato(registro.id);
        setResultado({fab:fabricantes.find(f=>f.codigoFabricante===achada.codigoFabricante),corr:achada,jaExistia:true});
        return;
      }
    }

    setResultado(null);
  },[corrs,fabricantes,produtosGG,garantirNoExtrato]);

  const pesquisa = useMemo(()=>{
    const q=normalizar(busca);
    if(!q) return [];
    return corrs.filter(c=>normalizar([
      c.codigoFabricante,c.codigoAutomatico,c.codigoManual,c.produtoFabricante,c.produtoGG
    ].join(' ')).includes(q)).slice(0,20);
  },[busca,corrs]);

  const extratoFiltrado = useMemo(()=>{
    const q=normalizar(extratoFiltro);
    if(!q) return historico;
    return historico.filter(x=>normalizar([
      x.codigoPesquisado,x.codigoFabricante,x.codigoAutomatico,x.codigoManual,x.produtoFabricante,x.produtoGG
    ].join(' ')).includes(q));
  },[historico,extratoFiltro]);

  async function confirmar(fab:ProdutoFabricante,gg:ProdutoGG,score:number){
    const existente=corrs.find(x=>x.codigoFabricante===fab.codigoFabricante);
    if(existente){
      const registro=await garantirNoExtrato(existente,fab.codigoFabricante);
      setDestacarExtrato(registro.id);
      setResultado({fab,corr:existente,jaExistia:true});
      return;
    }

    const item:Correspondencia={
      id:fab.codigoFabricante,
      codigoFabricante:fab.codigoFabricante,
      produtoFabricante:fab.produto,
      produtoGGId:gg.id,
      codigoAutomatico:gg.codigoAutomatico,
      codigoManual:gg.codigoManual,
      produtoGG:gg.produto,
      status:'CONFIRMADO',
      score
    };

    await salvarCorrespondencia(item);
    const registro=criarItemExtrato(item,fab.codigoFabricante);
    await salvarHistorico(registro);
    await recarregar();
    setDestacarExtrato(registro.id);
    setResultado({fab,corr:item,jaExistia:false});
  }

  function verNoExtrato(corr:Correspondencia){
    const termo=corr.codigoFabricante;
    setExtratoBusca(termo);
    setExtratoFiltro(termo);
    setDestacarExtrato(idExtrato(corr.codigoFabricante));
    setAba('extrato');
  }

  function confirmarSubstituicao(nome:string){
    return window.confirm(`Deseja substituir a planilha anterior de ${nome}?\n\nAo confirmar, a nova planilha passará a ser a base oficial dessa categoria.`);
  }

  async function handleImport(kind:TipoPlanilha,file?:File){
    if(!file)return;

    const nome=kind==='fab'?'Fabricantes':kind==='gg-manual'?'GG Manual':'GG Automático';
    if(!confirmarSubstituicao(nome)) return;

    if(kind==='fab'){
      const novos=await importarFabricantes(file);
      await salvarFabricantes(novos,true);
    }

    if(kind==='gg-manual'){
      const novos=await importarGGManual(file);
      const atuais=await listarProdutosGG();
      const porProduto=new Map<string,ProdutoGG>(
        atuais.map(x=>[chaveProduto(x.produto),{...x,codigoManual:undefined} as ProdutoGG])
      );

      novos.forEach(x=>{
        const k=chaveProduto(x.produto);
        const atual=porProduto.get(k);
        if(atual){
          porProduto.set(k,{...atual,codigoManual:x.codigoManual});
        }else{
          porProduto.set(k,{
            id:`manual-${x.codigoManual}`,
            codigoAutomatico:'',
            codigoManual:x.codigoManual,
            produto:x.produto
          });
        }
      });

      await salvarProdutosGG([...porProduto.values()],true);
    }

    if(kind==='gg-auto'){
      const novos=await importarGGAutomatico(file);
      const atuais=await listarProdutosGG();
      const porProduto=new Map<string,ProdutoGG>(
        atuais.map(x=>[chaveProduto(x.produto),{...x,codigoAutomatico:''} as ProdutoGG])
      );

      novos.forEach(x=>{
        const k=chaveProduto(x.produto);
        const atual=porProduto.get(k);
        if(atual){
          porProduto.set(k,{
            ...atual,
            id:atual.id.startsWith('manual-')?`auto-${x.codigoAutomatico}`:atual.id,
            codigoAutomatico:x.codigoAutomatico
          });
        }else{
          porProduto.set(k,{
            id:`auto-${x.codigoAutomatico}`,
            codigoAutomatico:x.codigoAutomatico,
            produto:x.produto
          });
        }
      });

      await salvarProdutosGG([...porProduto.values()],true);
    }

    await recarregar();
    setPlanilhasOpen(false);
    window.alert(`Planilha ${nome} substituída com sucesso.`);
  }

  function fecharEExecutar(fn:()=>void){
    fn();
    setPlanilhasOpen(false);
  }

  return <div className="app">
    <header>
      <div className="header-brand"><BrandMark compact/><span>Leitor de Código de Barras</span></div>
      <div className="header-actions">
        <div className="sheet-menu-wrap">
          <button className="sheet-menu-button" onClick={()=>setPlanilhasOpen(v=>!v)} aria-expanded={planilhasOpen} aria-haspopup="menu">Planilhas ▾</button>
          {planilhasOpen&&<div className="sheet-menu" role="menu">
            <button onClick={()=>setPlanilhasOpen(false)} aria-label="Fechar menu">✕ Fechar</button>
            <b>1. Fabricantes</b>
            <button onClick={()=>fecharEExecutar(modeloFabricantes)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('fab',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarFabricantes(fabricantes))}>Exportar .xlsx</button>

            <b>2. GG Manual</b>
            <button onClick={()=>fecharEExecutar(modeloGGManual)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-manual',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarGGManual(produtosGG))}>Exportar .xlsx</button>

            <b>3. GG Automático</b>
            <button onClick={()=>fecharEExecutar(modeloGGAutomatico)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-auto',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarGGAutomatico(produtosGG))}>Exportar .xlsx</button>

            <b>Relatórios</b>
            <button className="sheet-menu-primary" onClick={()=>fecharEExecutar(()=>exportarConsolidado(fabricantes,produtosGG,corrs))}>Exportar Consolidado</button>
            <button onClick={()=>fecharEExecutar(()=>exportarExtrato(historico))}>Exportar Extrato</button>
          </div>}
        </div>
      </div>
    </header>

    <main>
      {aba==='leitor'&&<section>
        <h1>Localizar códigos do produto</h1>
        <p className="muted">Leia o código do fabricante ou pesquise por qualquer um dos três códigos. O sistema verifica primeiro se a comparação já foi feita.</p>
        <div className="search">
          <input value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void resolver(busca);}} placeholder="Digite qualquer um dos 3 códigos"/>
          <button className="primary" onClick={()=>void resolver(busca)}>Buscar</button>
        </div>
        <button className="primary wide" onClick={()=>setScanning(v=>!v)}>{scanning?'Fechar câmera':'Abrir câmera'}</button>
        {scanning&&<Scanner onCode={codigo=>{void resolver(codigo);}}/>}

        {resultado?.corr&&<>
          {resultado.jaExistia&&<div className="already-banner">
            <div><b>✓ Já temos esta correspondência.</b><small>Ela já foi realizada e está registrada no Extrato. Nenhuma duplicação foi criada.</small></div>
            <button onClick={()=>verNoExtrato(resultado.corr!)}>Ver no Extrato</button>
          </div>}
          {!resultado.jaExistia&&<div className="new-banner"><b>✓ Nova correspondência registrada.</b><span>O registro foi incluído no Extrato.</span></div>}
          <div className="card success comparison-card">
            <h2>Comparação do produto</h2>
            <b>{resultado.corr.produtoGG}</b>
            <dl>
              <dt>Código fabricante</dt><dd>{resultado.corr.codigoFabricante}</dd>
              <dt>GG automático</dt><dd>{resultado.corr.codigoAutomatico||'Não informado'}</dd>
              <dt>GG manual</dt><dd>{resultado.corr.codigoManual||'Não informado'}</dd>
              <dt>Compatibilidade</dt><dd>{resultado.corr.score}%</dd>
            </dl>
          </div>
        </>}

        {resultado?.fab&&!resultado.corr&&<div className="card">
          <h2>{resultado.fab.produto}</h2>
          <p>Código fabricante: <b>{resultado.fab.codigoFabricante}</b></p>
          <p className="muted">Ainda não existe correspondência confirmada para este código. Selecione o produto GG correto:</p>
          <h3>Possíveis produtos GG</h3>
          {resultado.candidatos?.map(x=><button className="candidate" key={x.produto.id} onClick={()=>void confirmar(resultado.fab!,x.produto,x.score)}>
            <span><b>{x.produto.produto}</b><small>Automático: {x.produto.codigoAutomatico||'—'} · Manual: {x.produto.codigoManual||'—'}</small></span><em>{x.score}%</em>
          </button>)}
        </div>}

        {!resultado&&busca&&<div className="not-found"><b>Nenhuma correspondência confirmada encontrada para este código.</b><span>Se o código estiver na base de fabricantes, confira a descrição ou faça a leitura novamente.</span></div>}

        {!resultado&&busca&&pesquisa.map(c=><button className="candidate" key={c.id} onClick={()=>void resolver(c.codigoFabricante)}>
          <span><b>{c.produtoGG}</b><small>{c.codigoFabricante} · {c.codigoAutomatico||'—'} · {c.codigoManual||'—'}</small></span>
        </button>)}
      </section>}

      {aba==='fabricantes'&&<section>
        <h1>Produtos dos fabricantes</h1>
        <p className="muted">Base 1: código e produto informados pelo fabricante.</p>
        <div className="actions">
          <label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('fab',e.target.files?.[0])}/></label>
          <button onClick={()=>exportarFabricantes(fabricantes)}>Exportar .xlsx</button>
          <button onClick={modeloFabricantes}>Baixar modelo</button>
        </div>
        <TableFab rows={fabricantes}/>
      </section>}

      {aba==='gg'&&<section>
        <h1>Produtos GG</h1>
        <p className="muted">A empresa possui duas bases de código para o mesmo produto: Manual e Automático.</p>
        <div className="gg-sheets-grid">
          <div className="card">
            <h3>GG Manual</h3><p><b>Cód.</b> + Produto/Serviço</p>
            <label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-manual',e.target.files?.[0])}/></label>
            <button onClick={()=>exportarGGManual(produtosGG)}>Exportar .xlsx</button>
            <button onClick={modeloGGManual}>Modelo</button>
          </div>
          <div className="card">
            <h3>GG Automático</h3><p><b>Cód. Barras</b> + Produto/Serviço</p>
            <label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-auto',e.target.files?.[0])}/></label>
            <button onClick={()=>exportarGGAutomatico(produtosGG)}>Exportar .xlsx</button>
            <button onClick={modeloGGAutomatico}>Modelo</button>
          </div>
        </div>
        <TableGG rows={produtosGG}/>
      </section>}

      {aba==='correspondencias'&&<section>
        <h1>Base consolidada</h1>
        <p className="muted">Relatório de saída com fabricante + GG manual + GG automático.</p>
        <button className="primary wide" onClick={()=>exportarConsolidado(fabricantes,produtosGG,corrs)}>Exportar Excel consolidado</button>
        <div className="stats"><span><b>{fabricantes.length}</b> fabricantes</span><span><b>{produtosGG.length}</b> produtos GG</span><span><b>{corrs.length}</b> vinculados</span></div>
        {corrs.map(c=><div className="card compact" key={c.id}>
          <b>{c.produtoGG}</b><small>Fabricante: {c.codigoFabricante}</small><small>GG automático: {c.codigoAutomatico||'—'}</small><small>GG manual: {c.codigoManual||'—'}</small>
          <button className="mini-link" onClick={()=>verNoExtrato(c)}>Ver no Extrato</button>
        </div>)}
      </section>}

      {aba==='extrato'&&<section>
        <div className="section-title-row"><div><h1>Extrato do que já foi feito</h1><p className="muted">Um registro por correspondência. Pesquisas repetidas não duplicam o Extrato.</p></div><button onClick={()=>exportarExtrato(historico)}>Exportar .xlsx</button></div>
        <div className="search">
          <input value={extratoBusca} onChange={e=>setExtratoBusca(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')setExtratoFiltro(extratoBusca);}} placeholder="Buscar por qualquer código ou produto"/>
          <button className="primary" onClick={()=>setExtratoFiltro(extratoBusca)}>Buscar</button>
        </div>
        {extratoFiltro&&<button className="clear-filter" onClick={()=>{setExtratoBusca('');setExtratoFiltro('');setDestacarExtrato(null);}}>Limpar busca</button>}
        <div className="extract-count">{extratoFiltrado.length} registro(s) localizado(s)</div>
        {extratoFiltrado.length===0&&<div className="not-found"><b>Nenhum registro encontrado no Extrato.</b></div>}
        {extratoFiltrado.map((x,i)=><div id={`extrato-${x.id}`} className={`card extract-card ${destacarExtrato===x.id?'highlight':''}`} key={x.id}>
          <div className="extract-head"><b>Registro {i+1}</b><span>{new Date(x.dataHora).toLocaleString('pt-BR')}</span></div>
          {destacarExtrato===x.id&&<div className="extract-found">← Registro localizado</div>}
          <strong>{x.produtoGG}</strong>
          <small>Produto fabricante: {x.produtoFabricante}</small>
          <dl>
            <dt>Código fabricante</dt><dd>{x.codigoFabricante}</dd>
            <dt>GG automático</dt><dd>{x.codigoAutomatico||'—'}</dd>
            <dt>GG manual</dt><dd>{x.codigoManual||'—'}</dd>
            <dt>Compatibilidade</dt><dd>{x.score}%</dd>
          </dl>
        </div>)}
      </section>}
    </main>

    <nav>{([
      ['leitor','Leitor'],
      ['fabricantes','Fabricantes'],
      ['gg','Códigos GG'],
      ['correspondencias','Consolidado'],
      ['extrato','Extrato']
    ] as [Aba,string][]).map(([k,l])=><button className={aba===k?'active':''} key={k} onClick={()=>setAba(k)}>{l}</button>)}</nav>
  </div>;
}

function TableFab({rows}:{rows:ProdutoFabricante[]}){
  return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>{x.codigoFabricante}</small><small>{[x.marca,x.embalagem,x.volumePeso].filter(Boolean).join(' · ')}</small></div>)}</div>;
}

function TableGG({rows}:{rows:ProdutoGG[]}){
  return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>Automático: {x.codigoAutomatico||'—'}</small><small>Manual: {x.codigoManual||'—'}</small></div>)}</div>;
}