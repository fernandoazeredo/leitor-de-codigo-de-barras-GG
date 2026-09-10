import type { ProdutoFabricante, ProdutoGG } from './types';

export function normalizar(v = '') {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/coca[- ]cola/g, 'coca cola')
    .replace(/\boriginal\b/g, 'comum')
    .replace(/\bunidades?\b/g, 'un')
    .replace(/\bgarrafas?\b/g, 'pet')
    .replace(/\blatas?\b/g, 'lata')
    .replace(/(\d+)\s*litros?\b/g, '$1l')
    .replace(/(\d+)\s*ml\b/g, '$1ml')
    .replace(/(\d+)\s*kg\b/g, '$1kg')
    .replace(/(\d+)\s*g\b/g, '$1g')
    .replace(/\bc\s*(\d+)\b/g, '$1un')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(v:string){
  return new Set(normalizar(v).split(' ').filter(x=>x.length>1));
}

function dice(a:Set<string>,b:Set<string>){
  if(!a.size||!b.size) return 0;
  let inter=0;
  a.forEach(x=>{if(b.has(x)) inter++;});
  return (2*inter)/(a.size+b.size);
}

function extrairMedidas(v:string){
  const n=normalizar(v).replace(/\s+/g,'');
  return new Set(n.match(/\d+(?:[.,]\d+)?(?:ml|l|kg|g|un)/g) ?? []);
}

function mesmaMedida(a:string,b:string){
  const ma=extrairMedidas(a);
  const mb=extrairMedidas(b);
  if(!ma.size||!mb.size) return null;
  return [...ma].some(x=>mb.has(x));
}

function contemTermo(a:string,b:string,termos:string[]){
  const aa=` ${normalizar(a)} `;
  const bb=` ${normalizar(b)} `;
  for(const termo of termos){
    const t=` ${normalizar(termo)} `;
    if(aa.includes(t)!==bb.includes(t)) return false;
  }
  return true;
}

export function scoreProduto(f:ProdutoFabricante,g:ProdutoGG){
  const textoF=[f.produto,f.marca,f.embalagem,f.volumePeso].filter(Boolean).join(' ');
  const textoG=[g.produto,g.marca,g.embalagem,g.volumePeso].filter(Boolean).join(' ');
  const base=dice(tokens(textoF),tokens(textoG));

  let score=base*70;

  const marcaF=normalizar(f.marca ?? '');
  const marcaG=normalizar(g.marca ?? '');
  if(marcaF&&marcaG) score+=marcaF===marcaG?10:-6;

  const medida=mesmaMedida(textoF,textoG);
  if(medida===true) score+=15;
  if(medida===false) score-=18;

  if(contemTermo(textoF,textoG,['lata','pet','zero','diet','light'])) score+=5;
  else score-=8;

  return Math.max(0,Math.min(100,Math.round(score)));
}

export function melhoresCandidatos(f:ProdutoFabricante,produtos:ProdutoGG[],limite=5){
  return produtos
    .map(p=>({produto:p,score:scoreProduto(f,p)}))
    .sort((a,b)=>b.score-a.score || a.produto.produto.localeCompare(b.produto.produto,'pt-BR'))
    .slice(0,limite);
}
