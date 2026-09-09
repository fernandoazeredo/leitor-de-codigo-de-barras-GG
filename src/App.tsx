import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scanner } from './Scanner';
import { firebaseEnabled } from './firebase';
import { listarCorrespondencias, listarFabricantes, listarProdutosGG, salvarCorrespondencia, salvarFabricantes, salvarProdutosGG } from './data';
import { exportarConsolidado, exportarFabricantes, exportarProdutosGG, importarFabricantes, importarProdutosGG, modeloFabricantes, modeloProdutosGG } from './excel';
import { melhoresCandidatos, normalizar } from './matching';
import type { Correspondencia, ProdutoFabricante, ProdutoGG } from './types';

type Aba = 'leitor'|'fabricantes'|'gg'|'correspondencias';

export default function App() {
  const [aba,setAba]=useState<Aba>('leitor');
  const [fabricantes,setFabricantes]=useState<ProdutoFabricante[]>([]);
  const [produtosGG,setProdutosGG]=useState<ProdutoGG[]>([]);
  const [corrs,setCorrs]=useState<Correspondencia[]>([]);
  const [busca,setBusca]=useState('');
  const [scanning,setScanning]=useState(false);
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

  async function handleImport(kind:'fab'|'gg', file?:File){ if(!file)return; if(kind==='fab') await salvarFabricantes(await importarFabricantes(file)); else await salvarProdutosGG(await importarProdutosGG(file)); await recarregar(); }

  return <div className="app">
    <header><div><strong>GG</strong><span>Leitor de Código de Barras</span></div><small>{firebaseEnabled?'Firebase conectado':'Modo local'}</small></header>
    <main>
      {aba==='leitor' && <section>
        <h1>Localizar códigos do produto</h1><p className="muted">Leia o código do fabricante ou pesquise pelo código do fabricante, código GG automático ou código GG manual.</p>
        <div className="search"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite qualquer um dos 3 códigos"/><button onClick={()=>resolver(busca)}>Buscar</button></div>
        <button className="primary wide" onClick={()=>setScanning(v=>!v)}>{scanning?'Fechar câmera':'Abrir câmera'}</button>
        {scanning && <Scanner onCode={resolver}/>} 
        {resultado?.corr && <div className="card success"><h2>Correspondência encontrada</h2><b>{resultado.corr.produtoGG}</b><dl><dt>Código fabricante</dt><dd>{resultado.corr.codigoFabricante}</dd><dt>Código GG automático</dt><dd>{resultado.corr.codigoAutomatico}</dd><dt>Código GG manual</dt><dd>{resultado.corr.codigoManual||'Não informado'}</dd><dt>Compatibilidade</dt><dd>{resultado.corr.score}%</dd></dl></div>}
        {resultado?.fab && !resultado.corr && <div className="card"><h2>{resultado.fab.produto}</h2><p>Código fabricante: <b>{resultado.fab.codigoFabricante}</b></p><h3>Possíveis produtos GG</h3>{resultado.candidatos?.map(x=><button className="candidate" key={x.produto.id} onClick={()=>confirmar(resultado.fab!,x.produto,x.score)}><span><b>{x.produto.produto}</b><small>Automático: {x.produto.codigoAutomatico} · Manual: {x.produto.codigoManual||'—'}</small></span><em>{x.score}%</em></button>)}</div>}
        {!resultado && busca && pesquisa.map(c=><button className="candidate" key={c.id} onClick={()=>resolver(c.codigoFabricante)}><span><b>{c.produtoGG}</b><small>{c.codigoFabricante} · {c.codigoAutomatico} · {c.codigoManual||'—'}</small></span></button>)}
      </section>}
      {aba==='fabricantes' && <section><h1>Produtos dos fabricantes</h1><div className="actions"><label className="button">Importar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('fab',e.target.files?.[0])}/></label><button onClick={()=>exportarFabricantes(fabricantes)}>Exportar</button><button onClick={modeloFabricantes}>Baixar modelo</button></div><TableFab rows={fabricantes}/></section>}
      {aba==='gg' && <section><h1>Produtos GG</h1><p className="muted">Cada produto pode ter código automático e código manual.</p><div className="actions"><label className="button">Importar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={e=>handleImport('gg',e.target.files?.[0])}/></label><button onClick={()=>exportarProdutosGG(produtosGG)}>Exportar</button><button onClick={modeloProdutosGG}>Baixar modelo</button></div><TableGG rows={produtosGG}/></section>}
      {aba==='correspondencias' && <section><h1>Base consolidada</h1><button className="primary wide" onClick={()=>exportarConsolidado(fabricantes,produtosGG,corrs)}>Exportar Excel consolidado</button><div className="stats"><span><b>{fabricantes.length}</b> fabricantes</span><span><b>{produtosGG.length}</b> produtos GG</span><span><b>{corrs.length}</b> vinculados</span></div>{corrs.map(c=><div className="card compact" key={c.id}><b>{c.produtoGG}</b><small>Fabricante: {c.codigoFabricante}</small><small>GG automático: {c.codigoAutomatico}</small><small>GG manual: {c.codigoManual||'—'}</small></div>)}</section>}
    </main>
    <nav>{([['leitor','Leitor'],['fabricantes','Fabricantes'],['gg','Códigos GG'],['correspondencias','Consolidado']] as [Aba,string][]).map(([k,l])=><button className={aba===k?'active':''} key={k} onClick={()=>setAba(k)}>{l}</button>)}</nav>
  </div>
}
function TableFab({rows}:{rows:ProdutoFabricante[]}){return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>{x.codigoFabricante}</small><small>{[x.marca,x.embalagem,x.volumePeso].filter(Boolean).join(' · ')}</small></div>)}</div>}
function TableGG({rows}:{rows:ProdutoGG[]}){return <div className="list">{rows.map(x=><div className="card compact" key={x.id}><b>{x.produto}</b><small>Automático: {x.codigoAutomatico}</small><small>Manual: {x.codigoManual||'—'}</small></div>)}</div>}
