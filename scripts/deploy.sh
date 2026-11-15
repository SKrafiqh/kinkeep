#!/usr/bin/env bash
# One-command Cloud Run deploy for KinKeep. Safe to run again: every step checks first.
# Needs: gcloud signed in (gcloud auth login), firebase-tools signed in (npx firebase-tools login),
# billing on the project, and a filled-in .env.deploy (see .env.deploy.example).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.deploy
[[ -f $ENV_FILE ]] || { echo "Missing $ENV_FILE. Copy .env.deploy.example and fill it in."; exit 1; }
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a
for name in PROJECT_ID REGION AI_API_KEY GMAIL_USER GMAIL_APP_PASSWORD; do
  [[ -n ${!name:-} ]] || { echo "Set $name in $ENV_FILE."; exit 1; }
done
AI_MODEL=${AI_MODEL:-gemma-4-31b-it}

SERVICE=kinkeep
RUN_SA=kinkeep-run@$PROJECT_ID.iam.gserviceaccount.com
SCHEDULER_SA=kinkeep-scheduler@$PROJECT_ID.iam.gserviceaccount.com
step() { printf '\n==> %s\n' "$1"; }

step "Project $PROJECT_ID in $REGION"
gcloud config set project "$PROJECT_ID" --quiet
if [[ $(gcloud billing projects describe "$PROJECT_ID" --format 'value(billingEnabled)') != True ]]; then
  echo "Billing is not enabled on $PROJECT_ID. Cloud Run needs it, even within the free tier."; exit 1
fi
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')
URL=https://$SERVICE-$PROJECT_NUMBER.$REGION.run.app

step "Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com iam.googleapis.com

step "Firestore (Native mode)"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 ||
  gcloud firestore databases create --location="$REGION"

step "Service accounts"
for sa in kinkeep-run kinkeep-scheduler; do
  gcloud iam service-accounts describe "$sa@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$sa" --display-name "KinKeep ${sa#kinkeep-}"
done
for role in roles/datastore.user roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$RUN_SA" --role "$role" --condition=None --quiet >/dev/null
done

# Values go through stdin, never the command line, so they never show in a process list or log.
put_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- >/dev/null
  fi
  echo "  $name stored"
}
# Signing secrets are made once. Replacing them later would sign everyone out and break emailed links.
make_secret_once() {
  if gcloud secrets describe "$1" >/dev/null 2>&1; then echo "  $1 kept"; else put_secret "$1" "$(openssl rand -base64 48 | tr -d '\n')"; fi
}

step "Secrets"
put_secret AI_API_KEY "$AI_API_KEY"
put_secret GMAIL_APP_PASSWORD "$GMAIL_APP_PASSWORD"
for name in SESSION_SECRET PASSCODE_PEPPER ACTION_TOKEN_SECRET; do make_secret_once "$name"; done

step "Firestore indexes, rules and TTL (before the first reminder run)"
npx --yes firebase-tools@15 deploy --only firestore:indexes,firestore:rules --project "$PROJECT_ID" --non-interactive

step "Building and deploying to Cloud Run (takes a few minutes)"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated --quiet \
  --service-account "$RUN_SA" \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 4 \
  --set-env-vars "APP_URL=$URL,EMAIL_PROVIDER=gmail,GMAIL_USER=$GMAIL_USER,AI_MODEL=$AI_MODEL,CRON_SERVICE_ACCOUNT=$SCHEDULER_SA" \
  --set-secrets "AI_API_KEY=AI_API_KEY:latest,GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest,SESSION_SECRET=SESSION_SECRET:latest,PASSCODE_PEPPER=PASSCODE_PEPPER:latest,ACTION_TOKEN_SECRET=ACTION_TOKEN_SECRET:latest"

step "Scheduler: reminder tick every 5 minutes"
JOB_FLAGS=(--location "$REGION" --schedule "*/5 * * * *" --time-zone Etc/UTC --uri "$URL/api/cron/tick" --http-method POST
  --oidc-service-account-email "$SCHEDULER_SA" --oidc-token-audience "$URL")
if gcloud scheduler jobs describe kinkeep-tick --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http kinkeep-tick "${JOB_FLAGS[@]}" --quiet >/dev/null
else
  gcloud scheduler jobs create http kinkeep-tick "${JOB_FLAGS[@]}" --quiet >/dev/null
fi

step "Checking the live service"
curl -fsS "$URL/api/health" && echo
gcloud scheduler jobs run kinkeep-tick --location "$REGION"
echo "Done. Live at $URL"
