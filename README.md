# Docs Ilegal — Starter

Repo de pornire (frontend + API) compatibil cu **Google Cloud Run** și cu preview-ul din Canvas.

## Structură
- `/frontend` — Vite + React (TypeScript), folosește `VITE_API_URL` pentru a vorbi cu API-ul.
- `/api` — Node + Express, endpoints:
  - `GET /me/magic-inbox/addresses`
  - `POST /me/magic-inbox/control`
  - `GET /documents/list`
  - `POST /documents/upload`
  - `POST /shares`
  - `DELETE /shares/:id`

## Rulare locală
```bash
cd api && npm install && npm run dev  # http://localhost:8080
cd ../frontend && npm install && cp .env.example .env.local && npm run dev  # http://localhost:5173
```

## Deploy Cloud Run (din directoarele respective)
```bash
# API
cd api
gcloud run deploy docs-ilegal-api --source . --region europe-west1 --allow-unauthenticated

# Frontend
cd ../frontend
export VITE_API_URL=https://<API_URL_DE_LA_PASUL_DE_SUS>
gcloud run deploy docs-ilegal-web --source . --region europe-west1 --allow-unauthenticated --set-build-env-vars VITE_API_URL=$VITE_API_URL
```
