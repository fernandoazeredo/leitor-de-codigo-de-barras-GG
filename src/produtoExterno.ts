import { auth } from './firebase';
import type { ProdutoExterno } from './types';

type RespostaIdentificacao = {
  encontrado: boolean;
  produto?: ProdutoExterno;
  fonteTentada?: string[];
  mensagem?: string;
};

export async function identificarProdutoExterno(codigo:string):Promise<RespostaIdentificacao>{
  const user=auth.currentUser;
  if(!user) throw new Error('Usuário não autenticado.');

  const token=await user.getIdToken();
  const resposta=await fetch('/api/identificar-produto',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${token}`
    },
    body:JSON.stringify({codigo})
  });

  let dados:RespostaIdentificacao|undefined;
  try{dados=await resposta.json() as RespostaIdentificacao;}catch{dados=undefined;}

  if(!resposta.ok){
    throw new Error(dados?.mensagem || `Falha ao consultar produto (${resposta.status}).`);
  }

  return dados ?? {encontrado:false,mensagem:'Resposta inválida do serviço de identificação.'};
}
