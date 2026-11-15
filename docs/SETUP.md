# KinKeep — Setup, Secrets and Deploy

These commands follow standard gcloud usage but have not been run against your project.
If a flag is rejected, run the command with `--help`; CLI flags change.

## 1. What you need before starting

Accounts

- [ ] Google Cloud project with billing enabled (Cloud Run requires a billing account
      even inside the free tier)
- [ ] Google AI Studio API key for Gemini
- [ ] A Google account for sending email, with 2-Step Verification on and an app password
- [ ] GitHub account; the repository must be public for submission
- [ ] Hack2skill / PromptWars platform login
- [ ] LinkedIn account for the mandatory post

Local tools

- [ ] Node.js (current LTS) and npm
- [ ] git
- [ ] gcloud CLI, signed in: `gcloud auth login`
- [ ] Claude Code
- Docker is optional: Cloud Build builds the image from source.

## 2. Environment variables

| Name | Secret | Example | Purpose |
| --- | --- | --- | --- |
| `APP_URL` | no | `https://kinkeep-xxxx.a.run.app` | Base URL for links in emails |
| `GOOGLE_CLOUD_PROJECT` | no | `kinkeep-prod` | Firestore project (set automatically on Cloud Run) |
| `GEMINI_API_KEY` | yes | | Gemini access |
| `GEMINI_MODEL` | no | `gemini-flash-latest` | Model id; confirm the current Flash id in AI Studio |
| `EMAIL_PROVIDER` | no | `gmail` or `console` | Which sender adapter to use |
| `GMAIL_USER` | no | `kinkeep.demo@gmail.com` | Sender address |
| `GMAIL_APP_PASSWORD` | yes | | 16-character app password |
| `SESSION_SECRET` | yes | 32+ random bytes | Signs the session cookie |
| `PASSCODE_PEPPER` | yes | 32+ random bytes | Keyed hash before scrypt |
| `ACTION_TOKEN_SECRET` | yes | 32+ random bytes | Signs one-tap email links |
| `CRON_SERVICE_ACCOUNT` | no | `kinkeep-scheduler@PROJECT.iam.gserviceaccount.com` | Expected caller of the tick |
| `CRON_SECRET` | yes, local only | | Stand-in for OIDC in local dev |

Generate a random secret: `openssl rand -base64 48`

## 3. Local development

```bash
cp .env.example .env.local        # fill in values; set EMAIL_PROVIDER=console
gcloud auth application-default login
npm install
npm run dev
```

Local runs use the real Firestore database through application-default credentials.
Tests use in-memory fakes and need no credentials or network.

Trigger the reminder engine locally:

```bash
curl -X POST http://localhost:3000/api/cron/tick -H "x-cron-secret: $CRON_SECRET"
```

## 4. One-time Google Cloud setup

```bash
export PROJECT_ID=your-project-id
export REGION=asia-south1          # Mumbai; use the nearest region that offers all services
gcloud config set project $PROJECT_ID

gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com firestore.googleapis.com \
  cloudscheduler.googleapis.com secretmanager.googleapis.com

# Firestore, Native mode
gcloud firestore databases create --location=$REGION

# Service accounts
gcloud iam service-accounts create kinkeep-run --display-name "KinKeep runtime"
gcloud iam service-accounts create kinkeep-scheduler --display-name "KinKeep scheduler"

RUN_SA=kinkeep-run@$PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$RUN_SA" --role roles/datastore.user
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member "serviceAccount:$RUN_SA" --role roles/secretmanager.secretAccessor

# Secrets (repeat for each secret in the table)
printf '%s' 'PASTE_VALUE' | gcloud secrets create GEMINI_API_KEY --data-file=-
printf '%s' 'PASTE_VALUE' | gcloud secrets create GMAIL_APP_PASSWORD --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create SESSION_SECRET --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create PASSCODE_PEPPER --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create ACTION_TOKEN_SECRET --data-file=-
```

Gmail app password: Google Account → Security → 2-Step Verification → App passwords.
Use a separate demo account, not a personal inbox.

## 5. Deploy

```bash
gcloud run deploy kinkeep --source . --region $REGION --allow-unauthenticated \
  --service-account $RUN_SA \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 4 \
  --set-env-vars EMAIL_PROVIDER=gmail,GMAIL_USER=YOUR_SENDER@gmail.com,GEMINI_MODEL=gemini-flash-latest,CRON_SERVICE_ACCOUNT=kinkeep-scheduler@$PROJECT_ID.iam.gserviceaccount.com \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest,SESSION_SECRET=SESSION_SECRET:latest,PASSCODE_PEPPER=PASSCODE_PEPPER:latest,ACTION_TOKEN_SECRET=ACTION_TOKEN_SECRET:latest

# The URL is known only after the first deploy; set it, then redeploy config
URL=$(gcloud run services describe kinkeep --region $REGION --format 'value(status.url)')
gcloud run services update kinkeep --region $REGION --update-env-vars APP_URL=$URL
```

If the first build fails on a permission error, grant the role named in the error to the
build service account it names, then rerun.

Indexes:

```bash
npx firebase-tools deploy --only firestore:indexes,firestore:rules --project $PROJECT_ID
```

## 6. Scheduler

```bash
gcloud scheduler jobs create http kinkeep-tick --location $REGION \
  --schedule "*/5 * * * *" --time-zone "Etc/UTC" \
  --uri "$URL/api/cron/tick" --http-method POST \
  --oidc-service-account-email kinkeep-scheduler@$PROJECT_ID.iam.gserviceaccount.com \
  --oidc-token-audience "$URL"

gcloud scheduler jobs run kinkeep-tick --location $REGION    # fire once to test
```

The app verifies the token's signature, audience (`APP_URL`) and service-account email.

## 7. Verify the deployment

- [ ] `curl $URL/api/health` returns 200
- [ ] Create a circle and sign in from a phone
- [ ] "Send me a test reminder" delivers an email to an address outside your account
- [ ] Demo circle's first dose email arrives and the Taken link works
- [ ] `gcloud run services logs read kinkeep --region $REGION` shows no errors
- [ ] Scheduler job's last run shows success

## 8. Cost and limits to know

- At demo scale this should stay inside free usage: Cloud Run (2 million requests a
  month), Firestore (50K reads and 20K writes a day, 1 GiB), and one Scheduler job out of
  the three free per billing account. Confirm Secret Manager's free allowance on its
  pricing page; five secrets is a small footprint either way.
- Gmail consumer accounts cap sending at roughly 500 recipients a day. Enough for
  judging; state it in the README.
- Gemini free-tier limits vary by model and change often. Check the live limits for your
  key in AI Studio before the demo, and keep the per-circle daily cap in place.
- Cold start: with `--min-instances 0` the first request after idle takes a few seconds.
  For the judging window, set `--min-instances 1` and set it back afterwards.
- Set a budget alert on the billing account before deploying.
