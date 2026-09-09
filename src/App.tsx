import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scanner } from './Scanner';
import { BrandMark } from './BrandMark';
import { firebaseEnabled } from './firebase';
import { listarCorrespondencias, listarFabricantes, listarProdutosGG, salvarCorrespondencia, salvarFabricantes, salvarProdutosGG } from './data';
import { exportarConsolidado, exportarFabricantes, exportarGGAutomatico, exportarGGManual, importarFabricantes, importarGGAutomatico, importarGGManual, modeloFabricantes, modeloGGAutomatico, modeloGGManual } from './excel';
import { melhoresCandidatos, normalizar } from './matching';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

type Aba = 'leitor'|'fabricantes'|'gg'|'correspondencias';
type TipoPlanilha = 'fab'|'gg-manual'|'gg-auto';

const chaveProduto = (s:string) => normalizar(s);

export default function App() {
  const [aba,setAba]=useState<Aba>('leitor');
  const [fabricantes,setFabricantes]=useState<ProdutoFabricante[]>([]);
  const [produtosGG,setProdutosGG]=useState<ProdutoGG[]>([]);
  const [corrs,setCorrs]=useState<Correspondencia[]>([]);
  const [busca,setBusca]=useState('');
  const [scanning,setScanning]=useState(false);
  const [planilhasOpen,setPlanilhasOpen]=useState(false);
  const [resultado,setResultado]=useState<{fab?:ProdutoFabricante; corr?:Correspondencia; candidatos?:ReturnType<typeof melhoresCandidatos>}|null>(null);

  async function recarregar(){
    const [f,g,c]=await Promise.all([listarFabricantes(),listarProdutosGG(),listarCorrespondencias()]);
    setFabricantes(f); setProdutosGG(g); setCorrs(c);
  }
  useEffect(()=>{void recarregar();},[]);

  const resolver = useCallback((codigo:string) => {
    const c = codigo.trim(); setBusca(c); setScanning(false);
    const corr = corrs.find(x => x.codigoFabricante===c || x.codigoAutomatico===c || x.codigoManual===c);
    if (corr) { setResultado({ fab:fabricantes.find(x=>x.codigoFabricante===corr.codigoFabricante), corr }); return; }
    const fab = fabricantes.find(x=>x.codigoFabricante===c);
    if (fab) { setResultado({ fab, candidatos:melhoresCandidatos(fab, produtosGG) }); return; }
    const gg = produtosGG.find(x=>x.codigoAutomatico===c || x.codigoManual===c);
    if (gg) {
      const achadas=corrs.filter(x=>x.produtoGGId===gg.id);
      if (achadas.length) { const x=achadas[0]; setResultado({fab:fabricantes.find(f=>f.codigoFabricante===x.codigoFabricante),corr:x}); return; }
    }
    setResultado(null);
  },[corrs,fabricantes,produtosGG]);

  const pesquisa = useMemo(()=>{
    const q=normalizar(busca); if(!q) return [];
    return corrs.filter(c=>normalizar([c.codigoFabricante,c.codigoAutomatico,c.codigoManual,c.produtoFabricante,c.produtoGG].join(' ')).includes(q)).slice(0,20);
  },[busca,corrs]);

  async function confirmar(fab:ProdutoFabricante, gg:ProdutoGG, score:number){
    const item:Correspondencia={id:fab.codigoFabricante,codigoFabricante:fab.codigoFabricante,produtoFabricante:fab.produto,produtoGGId:gg.id,codigoAutomatico:gg.codigoAutomatico,codigoManual:gg.codigoManual,produtoGG:gg.produto,status:'CONFIRMADO',score};
    await salvarCorrespondencia(item); await recarregar(); setResultado({fab,corr:item});
  }

  function confirmarSubstituicao(nome:string){
    return window.confirm(`Deseja substituir a planilha anterior de ${nome}?\n\nAo confirmar, a nova planilha passará a ser a base oficial dessa categoria.`);
  }

  async function handleImport(kind:TipoPlanilha, file?:File){
    if(!file)return;

    const nome = kind==='fab' ? 'Fabricantes' : kind==='gg-manual' ? 'GG Manual' : 'GG Automático';
    if(!confirmarSubstituicao(nome)) return;

    if(kind==='fab') {
      const novos = await importarFabricantes(file);
      await salvarFabricantes(novos, true);
    }

    if(kind==='gg-manual') {
      const novos = await importarGGManual(file);
      const atuais = await listarProdutosGG();
      const porProduto = new Map(atuais.map(x=>[chaveProduto(x.produto), {...x, codigoManual: undefined}]));

      novos.forEach(x=>{
        const k=chaveProduto(x.produto);
        const atual=porProduto.get(k);
        if(atual) {
          atual.codigoManual=x.codigoManual;
          porProduto.set(k,atual);
        } else {
          porProduto.set(k,{
            id:`manual-${x.codigoManual}`,
            codigoAutomatico:'',
            codigoManual:x.codigoManual,
            produto:x.produto
          });
        }
      });

      await salvarProdutosGG([...porProduto.values()], true);
    }

    if(kind==='gg-auto') {
      const novos = await importarGGAutomatico(file);
      const atuais = await listarProdutosGG();
      const porProduto = new Map(atuais.map(x=>[chaveProduto(x.produto), {...x, codigoAutomatico: ''}]));

      novos.forEach(x=>{
        const k=chaveProduto(x.produto);
        const atual=porProduto.get(k);
        if(atual) {
          atual.codigoAutomatico=x.codigoAutomatico;
          if(atual.id.startsWith('manual-')) atual.id=`auto-${x.codigoAutomatico}`;
          porProduto.set(k,atual);
        } else {
          porProduto.set(k,{
            id:`auto-${x.codigoAutomatico}`,
            codigoAutomatico:x.codigoAutomatico,
            produto:x.produto
          });
        }
      });

      await salvarProdutosGG([...porProduto.values()], true);
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
        <small>{firebaseEnabled?'Firebase conectado':'Modo local'}</small>
        <div className="sheet-menu-wrap">
          <button className="sheet-menu-button" onClick={()=>setPlanilhasOpen(v=>!v)} aria-expanded={planilhasOpen} aria-haspopup="menu">Planilhas ▾</button>
          {planilhasOpen && <div className="sheet-menu" role="menu">
            <b>1. Fabricantes</b>
            <button onClick={()=>fecharEExecutar(modeloFabricantes)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('fab',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarFabricantes(fabricantes))}>Exportar Fabricantes</button>

            <b>2. GG Manual</b>
            <button onClick={()=>fecharEExecutar(modeloGGManual)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-manual',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarGGManual(produtosGG))}>Exportar GG Manual</button>

            <b>3. GG Automático</b>
            <button onClick={()=>fecharEExecutar(modeloGGAutomatico)}>Baixar modelo</button>
            <label className="sheet-menu-import">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-auto',e.target.files?.[0])}/></label>
            <button onClick={()=>fecharEExecutar(()=>exportarGGAutomatico(produtosGG))}>Exportar GG Automático</button>

            <b>Relatório</b>
            <button className="sheet-menu-primary" onClick={()=>fecharEExecutar(()=>exportarConsolidado(fabricantes,produtosGG,corrs))}>Exportar Consolidado</button>
          </div>}
        </div>
      </div>
    </header>
    <main>
      {aba==='leitor' && <section>
        <h1>Localizar códigos do produto</h1><p className="muted">Leia o código do fabricante ou pesquise pelo código do fabricante, código GG automático ou código GG manual.</p>
        <div className="search"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite qualquer um dos 3 códigos"/><button onClick={()=>resolver(busca)}>Buscar</button></div>
        <button className="primary wide" onClick={()=>setScanning(v=>!v)}>{scanning?'Fechar câmera':'Abrir câmera'}</button>
        {scanning && <Scanner onCode={resolver}/>} 
        {resultado?.corr && <div className="card success"><h2>Correspondência encontrada</h2><b>{resultado.corr.produtoGG}</b><dl><dt>Código fabricante</dt><dd>{resultado.corr.codigoFabricante}</dd><dt>Código GG automático</dt><dd>{resultado.corr.codigoAutomatico}</dd><dt>Código GG manual</dt><dd>{resultado.corr.codigoManual||'Não informado'}</dd><dt>Compatibilidade</dt><dd>{resultado.corr.score}%</dd></dl></div>}
        {resultado?.fab && !resultado.corr && <div className="card"><h2>{resultado.fab.produto}</h2><p>Código fabricante: <b>{resultado.fab.codigoFabricante}</b></p><h3>Possíveis produtos GG</h3>{resultado.candidatos?.map(x=><button className="candidate" key={x.produto.id} onClick={()=>confirmar(resultado.fab!,x.produto,x.score)}><span><b>{x.produto.produto}</b><small>Automático: {x.produto.codigoAutomatico||'—'} · Manual: {x.produto.codigoManual||'—'}</small></span><em>{x.score}%</em></button>)}</div>}
        {!resultado && busca && pesquisa.map(c=><button className="candidate" key={c.id} onClick={()=>resolver(c.codigoFabricante)}><span><b>{c.produtoGG}</b><small>{c.codigoFabricante} · {c.codigoAutomatico||'—'} · {c.codigoManual||'—'}</small></span></button>)}
      </section>}

      {aba==='fabricantes' && <section><h1>Produtos dos fabricantes</h1><p className="muted">Base 1: código e produto informados pelo fabricante.</p><div className="actions"><label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('fab',e.target.files?.[0])}/></label><button onClick={()=>exportarFabricantes(fabricantes)}>Exportar</button><button onClick={modeloFabricantes}>Baixar modelo</button></div><TableFab rows={fabricantes}/></section>}

      {aba==='gg' && <section><h1>Produtos GG</h1><p className="muted">A empresa possui duas bases de código para o mesmo produto: Manual e Automático.</p><div className="gg-sheets-grid"><div className="card"><h3>GG Manual</h3><p><b>Cód.</b> + Produto/Serviço</p><label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-manual',e.target.files?.[0])}/></label><button onClick={()=>exportarGGManual(produtosGG)}>Exportar</button><button onClick={modeloGGManual}>Modelo</button></div><div className="card"><h3>GG Automático</h3><p><b>Cód. Barras</b> + Produto/Serviço</p><label className="button">Importar / Substituir<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg-auto',e.target.files?.[0])}/></label><button onClick={()=>exportarGGAutomatico(produtosGG)}>Exportar</button><button onClick={modeloGGAutomatico}>Modelo</button></div></div><TableGG rows={produtosGG}/></section>}

      {aba==='correspondencias' && <section><h1>Base consolidada</h1><p className="muted">Relatório de saída com fabricante + GG manual + GG automático.</p><button className="primary wide" onClick={()=>exportarConsolidado(fabricantes,produtosGG,corrs)}>Exportar Excel consolidado</button><div className="stats"><span><b>{fabricantes.length}</b> fabricantes</span><span><b>{produtosGG.length}</b> produtos GG</span><span><b>{corrs.length}</b> vinculados</span></div>{corrs.map(c=><div className="card compact" key={c.id}><b>{c.produtoGG}</b><small>Fabricante: {c.codigoFabricante}</small><small>GG automático: {c.codigoAutomatico||'—'}</small><small>GG manual: {c.codigoManual||'—'}</small></div>)}</section>}
    </main>
    <nav>{([['leitor','Leitor'],['fabricantes','Fabricantes'],['gg','Códigos GG'],['correspondencias','Consolidado']] as [Aba,string][]).map(([k,l])=><button className={aba===k?'active':''} key={k} onClick={()=>setAba(k)}>{l}</button>)}</nav>
  </div>
}

function TableFab({rows}:{rows:ProdutoFabricante[]}){return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>{x.codigoFabricante}</small><small>{[x.marca,x.embalagem,x.volumePeso].filter(Boolean).join(' · ')}</small></div>)}</div>}
function TableGG({rows}:{rows:ProdutoGG[]}){return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>Automático: {x.codigoAutomatico||'—'}</small><small>Manual: {x.codigoManual||'—'}</small></div>)}</div>}
