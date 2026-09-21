export type TipoUnidade = 'base'|'embalagem'|'retornavel'|'logistica'|'granel'|'volume';
export type Dimensao = 'contagem'|'volume';

export interface UnidadeMedida {
  sigla:string; nome:string; tipo:TipoUnidade; dimensao:Dimensao; fatorFixo:number|null;
}
export interface ProdutoUnidade {
  produtoId:string; unidade:string; fatorConversao:number;
}
export interface MovimentacaoConferencia {
  codigo:string; produtoId:string; quantidade:number; unidade:string; fatorUsado:number; quantidadeUN:number; dataHora:string;
}

export const UNIDADES:UnidadeMedida[]=[
  {sigla:'UN',nome:'Unidade',tipo:'base',dimensao:'contagem',fatorFixo:1},
  {sigla:'DZ',nome:'Dúzia',tipo:'embalagem',dimensao:'contagem',fatorFixo:12},
  {sigla:'PACK',nome:'Pack',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'FD',nome:'Fardo',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'BAND',nome:'Bandeja',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'CX',nome:'Caixa',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'GR',nome:'Engradado / Garrafeira',tipo:'retornavel',dimensao:'contagem',fatorFixo:null},
  {sigla:'DISP',nome:'Display',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'KIT',nome:'Kit / Combo',tipo:'embalagem',dimensao:'contagem',fatorFixo:null},
  {sigla:'PAL',nome:'Palete',tipo:'logistica',dimensao:'contagem',fatorFixo:null},
  {sigla:'BR',nome:'Barril / Keg',tipo:'granel',dimensao:'contagem',fatorFixo:1},
  {sigla:'GL',nome:'Galão',tipo:'granel',dimensao:'contagem',fatorFixo:1},
  {sigla:'BIB',nome:'Bag-in-box',tipo:'granel',dimensao:'contagem',fatorFixo:1},
  {sigla:'CASCO',nome:'Casco / Vasilhame',tipo:'retornavel',dimensao:'contagem',fatorFixo:1},
  {sigla:'ML',nome:'Mililitro',tipo:'volume',dimensao:'volume',fatorFixo:1},
  {sigla:'L',nome:'Litro',tipo:'volume',dimensao:'volume',fatorFixo:1000},
];

export function obterFator(sigla:string,produtoId:string,relacoes:ProdutoUnidade[]):number{
  const unidade=UNIDADES.find(u=>u.sigla===sigla);
  if(!unidade)throw new Error(`Unidade desconhecida: ${sigla}`);
  const relacao=relacoes.find(r=>r.produtoId===produtoId&&r.unidade===sigla);
  if(relacao)return relacao.fatorConversao;
  if(unidade.fatorFixo!==null)return unidade.fatorFixo;
  throw new Error(`Produto sem fator cadastrado para ${sigla}`);
}
export function unidadesDoProduto(produtoId:string,relacoes:ProdutoUnidade[]):UnidadeMedida[]{
  const siglas=new Set(relacoes.filter(r=>r.produtoId===produtoId).map(r=>r.unidade));
  return UNIDADES.filter(u=>u.sigla==='UN'||siglas.has(u.sigla));
}
export function montarMovimentacao(p:{codigo:string;produtoId:string;quantidade:number;unidade:string;relacoes:ProdutoUnidade[]}):MovimentacaoConferencia{
  const fatorUsado=obterFator(p.unidade,p.produtoId,p.relacoes);
  return {codigo:p.codigo,produtoId:p.produtoId,quantidade:p.quantidade,unidade:p.unidade,fatorUsado,quantidadeUN:p.quantidade*fatorUsado,dataHora:new Date().toISOString()};
}
