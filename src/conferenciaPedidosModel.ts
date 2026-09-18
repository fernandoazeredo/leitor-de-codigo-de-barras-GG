export type StatusConferencia = 'AGUARDANDO'|'EM_CONFERENCIA'|'CONFERIDO'|'DIVERGENCIA'|'LIBERADO_AUTORIZACAO';

export type TipoDivergencia = 'PRODUTO_ERRADO'|'QUANTIDADE_MAIOR'|'QUANTIDADE_MENOR';

export type DivergenciaConferencia = {
  id:string;
  tipo:TipoDivergencia;
  descricao:string;
  codigo?:string;
  dataHora:string;
};

export type ItemPedido = {
  id:string;
  codigoProduto?:string;
  ean?:string;
  descricao:string;
  unidade?:string;
  quantidade:number;
  conferido:number;
};

export type AutorizacaoDivergencia = {
  selfie:string;
  justificativa?:string; // opcional apenas para compatibilidade com registros antigos
  dataHora:string;
};

export type PedidoConferencia = {
  id:string;
  chaveNFe?:string;
  numeroNF:string;
  cliente:string;
  emitente?:string;
  dataEmissao?:string;
  itens:ItemPedido[];
  status:StatusConferencia;
  criadoEm:string;
  atualizadoEm:string;
  arquivoNome:string;
  divergencias?:DivergenciaConferencia[];
  conferenciaFinalizada?:boolean;
  autorizacao?:AutorizacaoDivergencia;
};

const numero = (v?:string) => Number(String(v ?? '0').replace(',','.')) || 0;
const texto = (el:Element, tag:string) => el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';

export function parseNFeXml(xml:string,arquivoNome:string):PedidoConferencia{
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('XML inválido.');
  const inf=doc.getElementsByTagName('infNFe')[0];
  if(!inf) throw new Error('O arquivo não contém uma NF-e reconhecida.');
  const ide=inf.getElementsByTagName('ide')[0];
  const emit=inf.getElementsByTagName('emit')[0];
  const dest=inf.getElementsByTagName('dest')[0];
  const numeroNF=ide?texto(ide,'nNF'):'';
  const chave=(inf.getAttribute('Id')||'').replace(/^NFe/,'');
  const itens=[...inf.getElementsByTagName('det')].map((det,index)=>{
    const prod=det.getElementsByTagName('prod')[0];
    const ean=prod?(texto(prod,'cEAN')||texto(prod,'cEANTrib')):'';
    return {
      id:det.getAttribute('nItem')||String(index+1),
      codigoProduto:prod?texto(prod,'cProd'):undefined,
      ean:ean && !/SEM GTIN/i.test(ean)?ean:undefined,
      descricao:prod?texto(prod,'xProd'):`Item ${index+1}`,
      unidade:prod?texto(prod,'uCom'):undefined,
      quantidade:prod?numero(texto(prod,'qCom')):0,
      conferido:0
    } satisfies ItemPedido;
  });
  if(!itens.length) throw new Error('A NF-e não possui itens para conferência.');
  const agora=new Date().toISOString();
  return {
    id:chave||`${numeroNF||'nf'}-${Date.now()}`,
    chaveNFe:chave||undefined,
    numeroNF:numeroNF||'Sem número',
    cliente:dest?texto(dest,'xNome'):'Cliente não identificado',
    emitente:emit?texto(emit,'xNome'):undefined,
    dataEmissao:ide?(texto(ide,'dhEmi')||texto(ide,'dEmi')):undefined,
    itens,status:'AGUARDANDO',criadoEm:agora,atualizadoEm:agora,arquivoNome,
    divergencias:[],conferenciaFinalizada:false
  };
}

export function situacaoItem(item:ItemPedido){
  if(item.conferido===item.quantidade) return 'OK' as const;
  if(item.conferido<item.quantidade) return 'FALTANDO' as const;
  return 'EXCEDENTE' as const;
}

export function temDivergenciaReal(pedido:PedidoConferencia){
  return Boolean((pedido.divergencias?.length||0)>0 || pedido.itens.some(i=>i.conferido>i.quantidade) || (pedido.conferenciaFinalizada && pedido.itens.some(i=>i.conferido<i.quantidade)));
}

export function recalcularStatus(pedido:PedidoConferencia):StatusConferencia{
  if(pedido.autorizacao) return 'LIBERADO_AUTORIZACAO';
  if(temDivergenciaReal(pedido)) return 'DIVERGENCIA';
  if(pedido.itens.every(i=>i.conferido===i.quantidade)) return 'CONFERIDO';
  if(pedido.itens.some(i=>i.conferido>0)) return 'EM_CONFERENCIA';
  return 'AGUARDANDO';
}
