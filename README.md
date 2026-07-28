# Barella Plast — Sistema de Ordem de Produção (PCP)

Sistema real (backend + banco de dados) com login individual, hierarquia de
perfis e controle de permissões por aba — construído a partir da planilha
"Ordem de Produção Barella Plast".

## O que tem aqui

- **Backend**: Node.js + Express + Postgres (via `pg`) — pode ser o Postgres
  gerenciado do Supabase (recomendado, grátis) ou qualquer outro Postgres.
- **Frontend**: React (Vite), com o mesmo desenho de telas do protótipo validado.
- **Autenticação**: usuário e senha individuais, senha guardada com hash (bcrypt),
  sessão via token (JWT).
- **Permissões por aba**: uma tabela `permissions` no banco define, por perfil
  (Administrador, PCP, Operador, Almoxarifado, Qualidade, Gerência), quem pode
  **ver** e quem pode **editar** cada aba. É editável pela própria interface,
  em Administração → Permissões.

## 1. Instalar (a primeira vez, em qualquer computador)

Pré-requisitos:
- [Node.js](https://nodejs.org) versão 18 ou mais recente instalado.
- Uma connection string de Postgres em `DATABASE_URL` (ver seção 5.1 para criar
  uma grátis no Supabase). Sem isso o servidor recusa iniciar.

```bash
$env:DATABASE_URL = "sua connection string do Postgres"   # PowerShell
npm run setup
```

Isso faz três coisas: instala as dependências do servidor, instala e constrói
o frontend (`web/dist`), e cria as tabelas + usuários de demonstração no banco
apontado por `DATABASE_URL`.

## 2. Rodar o sistema

```bash
$env:DATABASE_URL = "sua connection string do Postgres"   # PowerShell, se ainda não estiver definida na sessão
npm start
```

Você verá algo como:

```
Barella Plast PCP rodando em http://0.0.0.0:3000
Acesse de outras máquinas da rede pelo IP local deste computador, ex: http://192.168.X.X:3000
```

No próprio computador, acesse **http://localhost:3000**.

## 3. Usuários de demonstração

| Login | Senha | Perfil |
|---|---|---|
| admin | admin123 | Administrador |
| ana.pcp | pcp123 | PCP / Engenharia |
| carlos.op | op123 | Operador |
| marcos.almox | almox123 | Almoxarifado |
| beatriz.qa | qual123 | Qualidade |
| roberto.ger | ger123 | Gerência |

**Troque essas senhas antes de usar com dados reais** (Administração → Usuários,
ou apagando esses usuários e criando os de verdade).

## 4. Rodar em várias máquinas da fábrica, com o mesmo banco de dados

Esse é o cenário de "sistema de verdade": um computador roda o servidor (o
comando `npm start` acima) e fica ligado; os outros computadores da fábrica
acessam pelo navegador, usando o **IP local** daquele computador:

```
http://192.168.X.X:3000
```

(troque `192.168.X.X` pelo IP mostrado no terminal quando o servidor iniciar,
ou veja em "Configurações de Rede" do computador que está rodando o servidor).

Todos os computadores vão ler e escrever no mesmo banco de dados
(`data/barella.db`), porque todos estão conversando com o mesmo servidor.

Dicas para esse modo:
- O computador que roda o servidor deve ficar ligado e conectado à rede o
  tempo todo em que o sistema estiver em uso.
- Configure esse computador com **IP fixo** na rede local (senão o endereço
  muda e os outros computadores perdem o acesso). Isso normalmente se faz no
  roteador (reserva de IP por MAC) ou nas configurações de rede do Windows/Linux.
- Para abrir para fora da rede da fábrica (acesso remoto), normalmente é
  preciso VPN ou redirecionamento de porta no roteador — fale com quem cuida
  da rede da empresa antes de fazer isso, por segurança.

## 5. Rodar na nuvem, com o domínio da empresa

Se preferir acesso de qualquer lugar (não só dentro da fábrica), o mesmo
código roda em um servidor de nuvem (VPS). Resumo do caminho:

1. Contratar um VPS (ex: um plano básico já é suficiente para esse porte).
2. Instalar Node.js nele, copiar esta pasta, rodar `npm run setup` e depois
   manter `npm start` sempre ativo (recomenda-se usar um gerenciador de
   processo como `pm2` para reiniciar sozinho se cair).
3. Apontar um subdomínio da GiroHub (ex: `producao.girohub.com.br`) para o IP
   desse servidor, e configurar HTTPS (ex: com Certbot/Let's Encrypt, gratuito).

Esse passo (contratar o servidor, configurar domínio e HTTPS) normalmente é
feito por quem cuida da infraestrutura — recomendo tocar essa etapa com o
Claude Code, que consegue acompanhar a configuração do servidor junto com você.

## 5.1 Rodar de graça na Vercel + Supabase (alternativa à opção 5)

Este projeto já vem preparado para essa combinação: banco Postgres no
**Supabase** (plano free) e hospedagem na **Vercel** (plano Hobby, também
free). O backend roda como função serverless (`api/index.js`) e o frontend
(`web/dist`) é servido como site estático — sem precisar de VPS nem de um
computador sempre ligado.

**Passo a passo:**

1. **Criar o projeto no Supabase** (se ainda não tiver um para este sistema):
   supabase.com → New Project.
2. **Pegar a connection string**: no painel do projeto, Project Settings →
   Database → Connection string → aba **Transaction** (pooler, porta 6543).
   Copie o valor — é o que vai virar `DATABASE_URL`.
3. **Migrar os dados reais** (se já usou o sistema com produtos/ordens/usuários
   cadastrados em `data/barella.db`): rode uma vez, localmente,
   ```bash
   # Windows (PowerShell)
   $env:DATABASE_URL = "cole aqui a connection string do Supabase"
   npm install
   node server/migrate-to-postgres.js
   ```
   Isso lê `data/barella.db` e insere tudo no Supabase (é seguro rodar mais
   de uma vez — não duplica linhas já migradas).
4. **Importar o projeto na Vercel**: pelo painel (vercel.com → Add New →
   Project, conectando um repositório Git) ou pela CLI, direto desta pasta:
   ```bash
   npm i -g vercel
   vercel login
   vercel link
   ```
5. **Configurar as variáveis de ambiente no projeto Vercel** (Project Settings
   → Environment Variables, ou `vercel env add`):
   - `DATABASE_URL` — a mesma connection string do passo 2.
   - `JWT_SECRET` — um valor longo e aleatório (gere com
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
6. **Deploy**:
   ```bash
   vercel --prod
   ```
   A Vercel constrói o frontend (`npm run build:web`) e publica a API como
   função serverless automaticamente, seguindo o `vercel.json` deste projeto.

Veja `.env.example` para a lista completa de variáveis. As seções 1-5 acima
(uso local, LAN, VPS) continuam funcionando normalmente — essa é só mais uma
forma de rodar o mesmo código.

## 6. Segurança — leia antes de usar com dados reais

- **JWT_SECRET**: defina essa variável de ambiente com um valor longo e
  aleatório antes de ir para produção. Se rodar com `NODE_ENV=production` e
  essa variável não estiver definida, o sistema **recusa iniciar** — isso é
  proposital, para não ir ao ar com o valor padrão de desenvolvimento.
  ```bash
  # Windows (PowerShell)
  $env:JWT_SECRET = "um-valor-bem-longo-e-aleatorio"
  # Linux/macOS
  export JWT_SECRET="um-valor-bem-longo-e-aleatorio"
  ```
- **ALLOWED_ORIGIN** (opcional): só é necessário se algum outro site/app for
  acessar a API deste sistema a partir de outro domínio. No uso normal (acessar
  pelo navegador no próprio endereço do sistema) não precisa definir nada.
- Troque todas as senhas de demonstração antes de usar com dados reais. Toda
  senha de usuário precisa ter no mínimo 8 caracteres.
- O login já é protegido contra tentativas repetidas (bloqueio temporário após
  10 tentativas erradas em 15 minutos, por IP).
- Se for expor na internet (opção da nuvem), use sempre HTTPS.
- Backup: se estiver usando Supabase, o próprio painel do projeto
  (Database → Backups) já mantém backups automáticos diários no plano free.
  `data/barella.db` (SQLite) só é usado hoje como origem pontual de
  `server/migrate-to-postgres.js` — não é mais o banco em uso.

## 7. Estrutura do projeto

```
server/               → backend (API, autenticação, banco de dados)
  routes/             → uma rota por recurso (produtos, ordens, apontamentos...)
  db.js               → conexão e schema do banco Postgres (pg)
  app.js              → monta o Express (rotas /api/...), sem listen/estático
  index.js            → uso local/LAN/VPS: app.js + estático + app.listen
  constants.js        → perfis, abas e permissões padrão
  seed.js             → popula o banco na primeira vez
  migrate-to-postgres.js → migra dados de data/barella.db (SQLite) para o Supabase
web/                  → frontend (React)
  src/App.jsx         → todas as telas do sistema
  src/api.js          → chamadas para o backend
data/barella.db       → banco SQLite local (uso local/LAN/VPS — ver seção 1-5)
api/index.js          → entrypoint serverless usado pela Vercel (ver seção 5.1)
vercel.json           → configuração de build/rotas da Vercel
```

## 8. Próximos passos possíveis

- Trocar SQLite por PostgreSQL, se o volume de dados crescer muito.
- Adicionar exportação para Excel/PDF das ordens de produção.
- Sincronizar com o inventário de matéria-prima em tempo real com o
  almoxarifado.
