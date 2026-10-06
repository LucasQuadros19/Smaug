# Smaug

Sistema de finanças pessoais que roda na própria máquina ou na rede de casa.

Guarda contas, transações, recorrências, orçamentos, metas e empréstimos (inclusive com sócios e comissão), e acompanha o patrimônio ao longo do tempo. Tem também uma área de cálculos e uma aba de mercado para ações e cripto, que ainda está em teste e não entra no patrimônio.

Backend em Flask com PostgreSQL, frontend em React com Vite.

## Como rodar

Precisa de Docker, Python 3.12 e Node 22.

1. Copie `.env.example` para `.env` e `backend/.env.example` para `backend/.env`, colocando a mesma senha do banco nos dois.
2. Suba o banco: `docker compose up -d db backup`
3. Backend:

   ```
   cd backend
   python3 -m venv venv
   ./venv/bin/pip install -r requirements.txt
   ./venv/bin/flask db upgrade
   ./venv/bin/python seed.py
   ```

4. Frontend: `cd frontend && npm install`

Depois disso, `./start.sh` sobe tudo e mostra o endereço para abrir no navegador, nesta máquina e na rede local.

Ainda não tem login, então deixe acessível só numa rede em que você confia.

## Testes

```
cd backend && ./venv/bin/python -m pytest
cd frontend && npm run check && npm run build
```

## Backup

O container `backup` faz um dump do banco a cada 6 horas em `backups/` e mantém os últimos 14 dias. Para restaurar um arquivo:

```
./backend/scripts/restore.sh backups/saldos-AAAAMMDD-HHMMSS.sql.gz
```
