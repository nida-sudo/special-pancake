# Ruh AI Campaign E2E Automation

Daily Playwright E2E suite for `app-qa.ruh.ai` Campaign module. Runs on a schedule
in GitHub Actions and emails a per-test pass/fail report to stakeholders.

## What this does

- **69 test cases** across 5 modules (Campaign Creation, Management, Prospects,
  Analytics, Integrations).
- **Daily run at 09:00 IST** (03:30 UTC) via GitHub Actions, plus a manual
  **Run workflow** button for ad-hoc triggers.
- After each run, sends an HTML email to `nida@ruh.ai` and `aakash@ruh.ai`
  with: total / passed / failed / skipped counts, runtime, per-test status with
  scenario name, and a link back to the GitHub Actions run page (with traces
  and screenshots attached as artifacts).
- Last stable run baseline: **60/69 passing (87%) in ~12.7 minutes**.

## Repository layout

```
.
|- tests/
|  |- ruh_campaign_e2e.spec.js        # the 69-TC suite
|  '- Prospects_Campaign_CSV.csv      # sample upload
|- reporters/
|  '- email-reporter.js               # custom Playwright reporter, emits HTML + emails
|- .github/workflows/
|  '- scheduled-e2e.yml               # daily cron + manual trigger
|- playwright.config.ts
|- package.json
|- .env.example                       # template (real .env is gitignored)
'- .gitignore
```

## One-time setup

### 1. Push this folder to a new GitHub repo

```sh
cd ruh-e2e-automation
git init
git add .
git commit -m "Initial commit: Ruh E2E automation"
git branch -M main
git remote add origin https://github.com/<YOUR-ORG>/<REPO>.git
git push -u origin main
```

### 2. Add GitHub Secrets

In the repo **Settings -> Secrets and variables -> Actions**, add:

| Name | Value |
|---|---|
| `SMTP_USER` | `nida33854@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-character Gmail App Password (https://myaccount.google.com/apppasswords) |
| `RUH_TEST_USER_EMAIL` | the test account email used to log in to `app-qa.ruh.ai` |
| `RUH_TEST_USER_PASSWORD` | the test account password |

> `MAIL_TO` is set as plain env in the workflow (`nida@ruh.ai,aakash@ruh.ai`)
> since recipient lists aren't sensitive. Edit `.github/workflows/scheduled-e2e.yml`
> to change them.

### 3. Verify the schedule

The workflow runs at **03:30 UTC daily** (= 09:00 IST). To change cadence,
edit the `cron:` line in `.github/workflows/scheduled-e2e.yml`. GitHub uses
standard 5-field cron (`minute hour day month weekday`).

### 4. Manual trigger

Go to **Actions -> Ruh E2E Daily -> Run workflow**. Pick the branch (`main`)
and click **Run**. Useful for re-running after a flaky failure or after pushing
spec changes.

## Local development

```sh
cp .env.example .env
# fill in TEST_USER_EMAIL / TEST_USER_PASSWORD; SMTP_* are optional locally
npm install
npx playwright install chromium

# Run all tests headed (default)
npm run test:headed

# Run a single test by grep
npx playwright test --grep "TC-22"

# Open the last HTML report
npm run report
```

If `SMTP_USER` is unset locally, the email reporter logs a warning and skips
the email. Tests still run.

## Updating the spec

Edit `tests/ruh_campaign_e2e.spec.js`, commit, push. The next scheduled run
picks it up. For an immediate verification, click **Run workflow** in the
Actions tab.

## Known stable failures (4)

These four cases fail intermittently against the QA env due to product-side
timing (not test-code bugs) and are tracked but not yet auto-skipped:

- `TC-14` Sequence tab not always rendered for empty campaigns
- `TC-25` Archived button selector doesn't match all UI states
- `TC-52` Sarah's data-export reply sometimes obscures the Metrics panel re-entry
- `TC-55` Metrics tab not visible immediately after panel re-open

Inspect the artifacts attached to each Actions run for traces and screenshots.

## Credentials policy

- **No real credentials live in this repo.** `tests/`, `reporters/`, and
  workflow files all read from `process.env`.
- `.env` is `.gitignore`d. Use `.env.example` as a template.
- For CI, all secrets live in **GitHub Actions Secrets**, never committed.
- The Gmail App Password is scoped to one app (Gmail SMTP). Revoke it from
  https://myaccount.google.com/apppasswords if compromised.
