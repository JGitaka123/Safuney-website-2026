# Setup runbook — PO's Windows machine

Everything here is copy-paste for **PowerShell**. Run the blocks in order. Each block says what it does
and how to tell it worked. Only two steps need you in a browser: `gh auth login` and `vercel login`.

## 1. Tools

Check what is installed:

```powershell
git --version; node --version; pnpm --version; gh --version; vercel --version
```

Install anything that printed an error (close and reopen PowerShell afterwards):

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e
corepack enable
npm install -g pnpm vercel
```

Expected: Node **v22.x** (20.9 or newer works), pnpm **10.x**.

## 2. GitHub

```powershell
gh auth login
# choose: GitHub.com → HTTPS → Yes (authenticate git) → Login with a web browser
```

Clone the repository and install dependencies:

```powershell
cd $HOME
git clone https://github.com/JGitaka123/Safuney-website-2026.git
cd Safuney-website-2026
pnpm install
pnpm ci
```

Expected: the last line reads `placeholder-guard: OK`.

### 2a. Protect `main`

This stops direct pushes and force-pushes to `main` and requires CI to pass before a merge. Run once.

```powershell
@'
{
  "required_status_checks": { "strict": true, "contexts": ["Lint, typecheck, build, placeholder guard"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "require_code_owner_reviews": true },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
'@ | Set-Content -Encoding utf8 protection.json

gh api -X PUT repos/JGitaka123/Safuney-website-2026/branches/main/protection --input protection.json
Remove-Item protection.json
```

Expected: a JSON blob starting with `"url": "https://api.github.com/repos/..."`. If GitHub replies that
branch protection is not available, the repository is private on a free plan: make it public or upgrade,
then rerun.

## 3. Vercel — first production deploy

**Preferred: the dashboard (does the Git connection and root directory in one go).**

1. Open https://vercel.com/new (log in to **your** account).
2. Import `JGitaka123/Safuney-website-2026`.
3. Project name: `safuney-website-2026`.
4. Framework preset: **Next.js** (auto-detected).
5. **Root Directory: `apps/web`** ← important; click *Edit* next to Root Directory and type it.
6. Leave build settings default. Click **Deploy**.

Expected: a green "Congratulations" screen with a URL like `https://safuney-website-2026.vercel.app`.
Open it on your phone. From now on every pull request gets its own preview URL and every merge to `main`
redeploys production.

Then link your local clone to the project so `vercel env pull` works:

```powershell
vercel login
vercel link --yes --project safuney-website-2026
```

**Alternative: CLI only** (use if the dashboard import fails):

```powershell
vercel login
vercel link              # "Set up and deploy"? → N. Link to existing project? → N. Name: safuney-website-2026
vercel git connect       # connects the GitHub repo
```

Then set Root Directory to `apps/web` under Vercel → Project → Settings → General.

## 4. Managed services (needed before Phase 1, not before)

In Vercel → your project → **Storage** → *Create Database*:

- **Neon** (Postgres) → name `safuney-db` → connect to all environments.
- **Upstash** (Redis) → name `safuney-cache` → connect to all environments.

In Vercel → **Integrations** → Marketplace → **Resend** → add to this project.

Check the variables landed (names only, no values are printed):

```powershell
vercel env ls
```

Expected to see at least: `DATABASE_URL`, an Upstash/KV pair (`KV_REST_API_URL` + `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), and `RESEND_API_KEY`. Tell Claude the exact names
you see; the code will be written to match.

Pull them for local development (this file is git-ignored and must never be committed):

```powershell
vercel env pull apps/web/.env.local
```

## 5. Run the site locally

```powershell
pnpm dev
```

Open http://localhost:3000 — or on your phone on the same Wi-Fi, `http://<your PC's IP>:3000`.

## Done when

- `pnpm ci` passes locally.
- `https://safuney-website-2026*.vercel.app` opens on your phone.
- `gh api repos/JGitaka123/Safuney-website-2026/branches/main/protection` returns JSON, not an error.
