export type ProdutoFabricante = {
  id: string;
  codigoFabricante: string;
  produto: string;
  marca?: string;
  embalagem?: string;
  volumePeso?: string;
  observacao?: string;
};

export type ProdutoGG = {
  id: string;
  codigoAutomatico: string;
  codigoManual?: string;
  produto: string;
  marca?: string;
  embalagem?: string;
  volumePeso?: string;
  observacao?: string;
};

export type Correspondencia = {
  id: string;
  codigoFabricante: string;
  produtoFabricante: string;
  produtoGGId: string;
  codigoAutomatico: string;
  codigoManual?: string;
  produtoGG: string;
  status: 'CONFIRMADO' | 'PENDENTE';
  score: number;
};
