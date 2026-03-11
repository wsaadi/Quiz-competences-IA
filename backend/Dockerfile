FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

# UVICORN_WORKERS defaults to 1 (dev). Set to 4+ in production for concurrency.
# Workers are managed by uvicorn directly — each worker handles async I/O.
CMD uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers ${UVICORN_WORKERS:-1}
