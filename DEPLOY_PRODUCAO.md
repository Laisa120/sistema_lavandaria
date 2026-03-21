# Deploy Produção SaaS (app/api/admin)

Arquitetura alvo:
- Cliente: `https://app.genomni.com`
- API: `https://api.genomni.com`
- Admin (oculto): `https://admin.genomni.com`

## 1) Servidor Real (Docker) - comando único

### Pré-requisitos
- Docker e Docker Compose instalados
- Porta `80` liberada no firewall

### Passos
1. Copie e ajuste variáveis:
   ```bash
   cp deploy/.env.prod.example deploy/.env.prod
   ```
   Gere `APP_KEY` com:
   ```bash
   docker run --rm -it php:8.2-cli php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
   ```
2. Suba tudo com um único comando:
   ```bash
   ./deploy/subir_prod.sh
   ```
3. Valide:
   - `https://api.genomni.com/up`
   - `https://api.genomni.com/api/bootstrap`

### Comandos úteis
- Parar sem apagar dados:
  ```bash
  ./deploy/parar_prod.sh
  ```
- Parar e apagar banco/cache (destrutivo):
  ```bash
  ./deploy/parar_prod.sh --apagar-dados
  ```

### Observações
- Não use `down -v` em produção, salvo reset intencional.
- O script de produção executa apenas `migrate --force` (não roda `seed` automático).
- Para HTTPS em servidor próprio, coloque um proxy reverso com TLS (Nginx/Caddy/Traefik) na frente da API.
- Configure CORS para `app.genomni.com` e `admin.genomni.com`.

## 2) Render (Blueprint)

Arquivo: `render.yaml`

### Como subir
1. No Render, clique em **New + Blueprint**.
2. Selecione este repositório.
3. Preencha variáveis `sync: false`:
   - Backend:
     - `APP_URL=https://api.genomni.com`
     - `FRONTEND_URL=https://app.genomni.com`
     - `APP_FRONTEND_URL=https://app.genomni.com`
     - `ADMIN_FRONTEND_URL=https://admin.genomni.com`
     - `FRONTEND_URLS=https://app.genomni.com,https://admin.genomni.com`
     - `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
   - Frontend Cliente:
     - `VITE_API_BASE_URL=https://api.genomni.com/api`
   - Frontend Admin:
     - `VITE_API_BASE_URL=https://api.genomni.com/api`
4. Faça o deploy.

### Serviços criados
- `lavasys-backend` (web)
- `lavasys-queue` (worker)
- `lavasys-redis`
- `genomni-app` (static site)
- `genomni-admin` (static site)

## 3) Vercel (alternativa para frontend)

Se optar por Vercel, crie dois projetos apontando para `frontend/`:

1. Projeto `genomni-app`
   - Domínio: `app.genomni.com`
   - Env:
     - `VITE_API_BASE_URL=https://api.genomni.com/api`
     - `VITE_APP_HOST=app.genomni.com`
     - `VITE_ADMIN_HOST=admin.genomni.com`
     - `VITE_FORCE_CONTEXT=app`

2. Projeto `genomni-admin`
   - Domínio: `admin.genomni.com`
   - Env:
     - `VITE_API_BASE_URL=https://api.genomni.com/api`
     - `VITE_APP_HOST=app.genomni.com`
     - `VITE_ADMIN_HOST=admin.genomni.com`
     - `VITE_FORCE_CONTEXT=admin`

## 4) Checklist Go-live
- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_KEY` definido
- [ ] CORS com `FRONTEND_URLS` correto (`app` + `admin`)
- [ ] Banco com backup e restore testados
- [ ] Healthcheck `/up` funcionando
- [ ] Queue worker online
- [ ] Logs/alertas configurados
- [ ] `app.genomni.com` sem exposição de admin no menu
- [ ] `admin.genomni.com` acessível apenas por URL direta

## 5) Diagnóstico rápido (quando cliente não consegue criar empresa, especialmente no telemóvel)

Sintoma comum:
- No frontend, erro de rede ao cadastrar empresa.
- Em telemóvel, formulário abre mas não conclui o cadastro.

Causas mais comuns em SaaS:
- `VITE_API_BASE_URL` incorreto no frontend (`app`/`admin`).
- CORS da API sem incluir `app.genomni.com`.
- API com `APP_URL` diferente do domínio real.

### Validação automática (recomendado)
Execute:
```bash
./deploy/diagnostico_saas.sh
```

Com URL customizada:
```bash
./deploy/diagnostico_saas.sh https://api.genomni.com https://app.genomni.com https://admin.genomni.com
```

Esse script valida:
- `GET /up` (API online)
- `GET /api/bootstrap`
- CORS preflight para `app` e `admin`
- acessibilidade da rota `POST /api/settings/register`

### Checklist de correção no Render/Vercel
1. Backend (`lavasys-backend`)
   - `APP_URL=https://api.genomni.com`
   - `FRONTEND_URLS=https://app.genomni.com,https://admin.genomni.com`
2. Frontend `genomni-app`
   - `VITE_API_BASE_URL=https://api.genomni.com/api`
3. Frontend `genomni-admin`
   - `VITE_API_BASE_URL=https://api.genomni.com/api`
4. Redeploy dos 3 serviços (`backend`, `genomni-app`, `genomni-admin`)
5. Testar novamente no telefone em `https://app.genomni.com`
