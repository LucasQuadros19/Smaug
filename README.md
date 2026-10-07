# Smaug

Sistema de finanças pessoais que roda na própria máquina ou na rede de casa.

Guarda contas, transações, recorrências, orçamentos, metas e empréstimos (inclusive com sócios e comissão), e acompanha o patrimônio ao longo do tempo. Tem também uma área de cálculos e uma aba de mercado para ações e cripto, que ainda está em teste e não entra no patrimônio.

Backend em Flask com PostgreSQL, frontend em React com Vite.

## Como rodar

Precisa de Docker, Python 3.12 e Node 22.

1. Copie `.env.example` para `.env` e `backend/.env.example` para `backend/.env`, colocando a mesma senha do banco nos dois. No `backend/.env`, a `SECRET_KEY` sai de `openssl rand -hex 32`.
2. Suba o banco: `docker compose up -d db backup`
3. Backend:

   ```
   cd backend
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ./venv/bin/flask db upgrade
   ```

4. Frontend: `cd frontend && npm install`

Depois disso, `./start.sh` sobe tudo e mostra o endereço para abrir no navegador, nesta máquina e na rede local.

Cada pessoa cria a própria conta na tela de entrada e só enxerga os próprios dados. A primeira conta criada fica com os dados que já existiam antes de haver contas.

## Testes

```
cd backend && ./venv/bin/python -m pytest
cd frontend && npm run check && npm run build
```

## Servidor

A cada push na `main`, a pipeline do GitHub roda os testes e, se passarem, publica a imagem `lucasquadros/smaug` no Docker Hub. Ela usa os secrets `DOCKER_USERNAME` e `DOCKER_TOKEN` do repositório.

A imagem traz o backend (gunicorn) e o frontend compilado na porta 5001, e aplica as migrações ao subir. No servidor ficam só o compose, que não vai para o repositório, e um `.env` com `POSTGRES_PASSWORD` e `SECRET_KEY`:

```
docker compose pull && docker compose up -d
```

## Backup

O container `backup` faz um dump do banco a cada 6 horas em `backups/` e mantém os últimos 14 dias. Para restaurar um arquivo:

```
./backend/scripts/restore.sh backups/saldos-AAAAMMDD-HHMMSS.sql.gz
```
