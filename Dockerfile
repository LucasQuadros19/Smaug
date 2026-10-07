FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM python:3.12-slim
ENV TZ=America/Sao_Paulo FLASK_APP=run.py FRONTEND_DIST=/app/frontend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./
COPY --from=frontend /frontend/dist ./frontend
RUN useradd --system smaug && mkdir instance && chown smaug instance
USER smaug
EXPOSE 5001
CMD ["sh", "-c", "flask db upgrade && exec gunicorn --bind 0.0.0.0:5001 --threads 4 --no-control-socket run:app"]
