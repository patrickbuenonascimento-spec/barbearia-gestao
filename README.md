# Barbearia Gestão

Repositório preparado para publicar o sistema da barbearia no Netlify com Functions.

## Estrutura

- `netlify.toml`: configuração do deploy.
- `_redirects`: fallback para SPA.
- `netlify/functions/sheets-proxy.js`: função que lê o Google Sheets sem erro de CORS.

## Google Sheets configurado

Planilha usada pelo sistema:

`https://docs.google.com/spreadsheets/d/1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc/edit`

Para funcionar, a planilha precisa estar em:

**Compartilhar → Qualquer pessoa com o link → Leitor**

## Teste da Function

Depois que o Netlify publicar este repositório, teste:

`https://SEU-SITE.netlify.app/.netlify/functions/sheets-proxy?spreadsheetId=1b_20CocuATTCEZ_HK0GD7JZ6_259DJBr6qwJK7VoxHc`

Se retornar JSON com `ok:true`, a leitura da planilha está funcionando.

## Importante

O arquivo principal `index.html` do sistema deve estar na raiz do repositório para o site completo abrir no Netlify.
