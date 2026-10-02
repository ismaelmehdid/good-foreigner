#!/usr/bin/env bash
# Deploy Good Foreigner to Cloud Run from source.
# Reads runtime config from .env.local and passes it as an env-vars file, so secrets never
# appear on the command line. Usage: scripts/deploy.sh [region]
set -euo pipefail

REGION="${1:-us-central1}"
SERVICE="good-foreigner"
KEYS="GEMINI_API_KEY GEMINI_MODEL GEMMA_MODEL GEMINI_FALLBACK_MODELS GOOGLE_CLIENT_ID"

ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/gf-env.XXXXXX")"
trap 'rm -f "$ENV_FILE"' EXIT

for key in $KEYS; do
  value="$(grep -E "^${key}=" .env.local | tail -1 | cut -d= -f2- || true)"
  if [ -n "$value" ]; then
    printf '%s: "%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
done

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --env-vars-file "$ENV_FILE" \
  --timeout 300 \
  --quiet

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
