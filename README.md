# Leitor de Código de Barras GG

Aplicativo mobile-first/PWA para conciliação de três identificadores do mesmo produto:

1. **Código do fabricante** (EAN/GTIN/UPC lido pela câmera ou digitado)
2. **Código GG automático** (gerado pelo sistema da empresa)
3. **Código GG manual** (criado manualmente pela empresa)

## Bancos separados

- `produtos_fabricantes`: código do fabricante + descrição comercial
- `produtos_gg`: produto GG + código automático + código manual
- `correspondencias`: vínculo confirmado entre produto fabricante e produto GG

## Funcionalidades da versão inicial

- Leitura pela câmera do celular
- Pesquisa por qualquer um dos três códigos
- Sugestão de correspondência pelo produto
- Confirmação do vínculo
- Importação e exportação Excel dos fabricantes
- Importação e exportação Excel dos produtos GG
- Excel consolidado contendo os três códigos
- Modelos Excel padronizados gerados pelo próprio app
- Modo local para homologação sem Firebase
- Preparado para Firestore e Firebase Hosting

## Modelo fabricantes

Colunas aceitas: `CODIGO_FABRICANTE`, `PRODUTO`, `MARCA`, `EMBALAGEM`, `VOLUME_PESO`, `OBSERVACAO`.

Também reconhece `EAN` ou `GTIN` no lugar de `CODIGO_FABRICANTE`.

## Modelo GG

Colunas aceitas: `CODIGO_AUTOMATICO`, `CODIGO_MANUAL`, `PRODUTO`, `MARCA`, `EMBALAGEM`, `VOLUME_PESO`, `OBSERVACAO`.

Também reconhece `CODIGO_INTERNO` como código automático.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

## Firebase

Copie `.env.example` para `.env` e preencha as credenciais do projeto Firebase. Sem essas variáveis o aplicativo entra automaticamente no modo local.

As regras incluídas no repositório começam bloqueadas por segurança; antes do uso real será configurado Firebase Authentication e as regras definitivas de acesso.
