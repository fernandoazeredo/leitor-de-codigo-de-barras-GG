export type ProdutoFabricante = {
  id: string;
  codigoFabricante: string;
  produto: string;
  marca?: string;
  embalagem?: string;
  volumePeso?: string;
  observacao?: string;
};

export type ProdutoExterno = {
  codigo: string;
  produto: string;
  marca?: string;
  embalagem?: string;
  volumePeso?: string;
  imagem?: string;
  ncm?: string;
  fonte: 'OPEN_FOOD_FACTS' | 'COSMOS' | 'MANUAL';
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

export type HistoricoComparacao = {
  id: string;
  tipo: 'VINCULO_CRIADO' | 'CONSULTA_EXISTENTE';
  dataHora: string;
  codigoPesquisado: string;
  codigoFabricante: string;
  codigoAutomatico: string;
  codigoManual?: string;
  produtoFabricante: string;
  produtoGG: string;
  score: number;
  usuario?: string;
};
