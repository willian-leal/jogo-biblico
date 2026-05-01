# Deploy do Backend no Render

## 1. Antes de criar o serviço

O backend usa SignalR/WebSocket e SQLite para reports/sugestões/admin.
No Render, use um Web Service Docker com disco persistente.

## 2. Variáveis de ambiente

Configure estas variáveis no Render:

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Data Source=/var/data/jogo_biblico.db
Jwt__Issuer=JogoBiblico
Jwt__Audience=JogoBiblicoUsers
Jwt__Secret=<gere uma chave longa e aleatória>
Admin__Name=Administrador
Admin__Email=<seu email de admin>
Admin__Password=<senha forte>
```

Use uma senha forte para `Admin__Password`. O usuário admin é criado na primeira inicialização do backend.

## 3. Configuração do Render

Há um `render.yaml` na raiz do repositório com:

- `rootDir`: `backend/JogoBiblicoBackend`
- runtime Docker
- health check em `/health`
- disco persistente em `/var/data`
- SQLite apontando para `/var/data/jogo_biblico.db`

Disco persistente exige serviço pago no Render. Sem disco, reports/sugestões/admin podem ser perdidos ao reiniciar.

## 4. Depois do deploy

Teste:

```text
https://SEU-BACKEND.onrender.com/health
```

Depois atualize o frontend:

```json
{
  "apiUrl": "https://SEU-BACKEND.onrender.com"
}
```

Esse valor fica em `frontend/jogo-biblico/public/config.json` para o build/deploy do frontend.
