import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {defineSecret} from 'firebase-functions/params';
import {onRequest} from 'firebase-functions/v2/https';

if (!getApps().length) initializeApp();

const COSMOS_TOKEN = defineSecret('COSMOS_TOKEN');
const OPEN_FOOD_FACTS_UA = 'LeitorCodigoBarrasGG/1.0 (https://leitor-codigo-barras-gg.web.app)';
const COSMOS_UA = 'LeitorCodigoBarrasGG/1.0 (Firebase Functions)';

type ProdutoExterno = {
  codigo: string;
  produto: string;
  marca?: string;
  embalagem?: string;
  volumePeso?: string;
  imagem?: string;
  ncm?: string;
  fonte: 'OPEN_FOOD_FACTS' | 'COSMOS';
};

function somenteCodigo(valor:unknown):string {
  return String(valor ?? '').trim().replace(/\D/g, '');
}

function texto(valor:unknown):string|undefined {
  const s = String(valor ?? '').trim();
  return s || undefined;
}

async function consultarOpenFoodFacts(codigo:string):Promise<ProdutoExterno|null> {
  const fields = [
    'code', 'product_name', 'product_name_pt', 'brands', 'quantity',
    'packaging', 'packaging_text', 'image_front_url'
  ].join(',');
  const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(codigo)}?fields=${encodeURIComponent(fields)}`;

  const resposta = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': OPEN_FOOD_FACTS_UA
    },
    signal: AbortSignal.timeout(8000)
  });

  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(`Open Food Facts respondeu HTTP ${resposta.status}`);

  const dados = await resposta.json() as Record<string, unknown>;
  const produto = (dados.product ?? null) as Record<string, unknown>|null;
  if (!produto) return null;

  const nome = texto(produto.product_name_pt) ?? texto(produto.product_name);
  if (!nome) return null;

  return {
    codigo,
    produto: nome,
    marca: texto(produto.brands),
    embalagem: texto(produto.packaging_text) ?? texto(produto.packaging),
    volumePeso: texto(produto.quantity),
    imagem: texto(produto.image_front_url),
    fonte: 'OPEN_FOOD_FACTS'
  };
}

async function consultarCosmos(codigo:string):Promise<ProdutoExterno|null> {
  const token = COSMOS_TOKEN.value();
  if (!token) throw new Error('COSMOS_TOKEN não configurado.');

  const url = `https://api.cosmos.bluesoft.com.br/gtins/${encodeURIComponent(codigo)}.json`;
  const resposta = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': COSMOS_UA,
      'X-Cosmos-Token': token
    },
    signal: AbortSignal.timeout(8000)
  });

  if (resposta.status === 404) return null;
  if (resposta.status === 429) throw new Error('Limite diário de consultas da Cosmos atingido.');
  if (!resposta.ok) throw new Error(`Cosmos respondeu HTTP ${resposta.status}`);

  const dados = await resposta.json() as Record<string, unknown>;
  const nome = texto(dados.description);
  if (!nome) return null;

  const marcaObj = (dados.brand ?? null) as Record<string, unknown>|null;
  const ncmObj = (dados.ncm ?? null) as Record<string, unknown>|null;
  const peso = dados.net_weight ?? dados.gross_weight;

  return {
    codigo,
    produto: nome,
    marca: marcaObj ? texto(marcaObj.name) : undefined,
    volumePeso: peso == null ? undefined : `${String(peso)} g`,
    imagem: texto(dados.thumbnail),
    ncm: ncmObj ? texto(ncmObj.code) : undefined,
    fonte: 'COSMOS'
  };
}

export const identificarProduto = onRequest({
  region: 'southamerica-east1',
  secrets: [COSMOS_TOKEN],
  timeoutSeconds: 30,
  memory: '256MiB'
}, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') {
    res.status(405).json({encontrado:false, mensagem:'Método não permitido.'});
    return;
  }

  const authorization = req.get('Authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({encontrado:false, mensagem:'Autenticação necessária.'});
    return;
  }

  try {
    await getAuth().verifyIdToken(match[1]);
  } catch {
    res.status(401).json({encontrado:false, mensagem:'Sessão inválida ou expirada.'});
    return;
  }

  const codigo = somenteCodigo(req.body?.codigo);
  if (!/^\d{8,14}$/.test(codigo)) {
    res.status(400).json({encontrado:false, mensagem:'Informe um código EAN/GTIN válido com 8 a 14 dígitos.'});
    return;
  }

  const fontesTentadas:string[] = [];
  const avisos:string[] = [];

  try {
    fontesTentadas.push('OPEN_FOOD_FACTS');
    const off = await consultarOpenFoodFacts(codigo);
    if (off) {
      res.status(200).json({encontrado:true, produto:off, fonteTentada:fontesTentadas});
      return;
    }
  } catch (erro) {
    avisos.push(erro instanceof Error ? erro.message : 'Falha no Open Food Facts.');
  }

  try {
    fontesTentadas.push('COSMOS');
    const cosmos = await consultarCosmos(codigo);
    if (cosmos) {
      res.status(200).json({encontrado:true, produto:cosmos, fonteTentada:fontesTentadas, avisos});
      return;
    }
  } catch (erro) {
    avisos.push(erro instanceof Error ? erro.message : 'Falha na Cosmos.');
  }

  res.status(200).json({
    encontrado:false,
    fonteTentada:fontesTentadas,
    avisos,
    mensagem:'Produto não identificado automaticamente. Informe parte do nome para comparar com a base GG.'
  });
});
