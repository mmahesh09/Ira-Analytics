# One-time database setup for Rankwise (local PostgreSQL).
# Run from the project folder in your own PowerShell:   .\setup-db.ps1
# - asks for the postgres password (hidden; never printed or stored anywhere except the two env files)
# - writes DATABASE_URL into backend/.env and frontend/.env.local
# - creates the "rankwise" database if missing
# - creates Better Auth's tables first (user, session, ...), then the app tables (sites, events, ...)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psql)) { $psql = (Get-Command psql -ErrorAction Stop).Source }

$secure = Read-Host "PostgreSQL password for user 'postgres'" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:PGPASSWORD = $plain

Write-Host "Checking the password..." -ForegroundColor Cyan
& $psql -h localhost -U postgres -d postgres -tAc "SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "Postgres rejected that password. Nothing was changed." -ForegroundColor Red; exit 1 }

$exists = & $psql -h localhost -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='rankwise'"
if ($exists -ne "1") {
  & $psql -h localhost -U postgres -d postgres -c "CREATE DATABASE rankwise" | Out-Null
  Write-Host "Created database 'rankwise'." -ForegroundColor Green
} else { Write-Host "Database 'rankwise' already exists." }

# URL-encode so passwords with @ : / # etc. still work in the connection string
$encoded = [Uri]::EscapeDataString($plain)
$pattern = '^(DATABASE_URL=postgres(?:ql)?(?:\+asyncpg)?://postgres:)[^@]*(@.*)$'
foreach ($file in "$root\backend\.env", "$root\frontend\.env.local") {
  $lines = Get-Content $file | ForEach-Object { if ($_ -match $pattern) { $Matches[1] + $encoded + $Matches[2] } else { $_ } }
  Set-Content $file $lines -Encoding utf8
}
Write-Host "Saved DATABASE_URL in backend/.env and frontend/.env.local." -ForegroundColor Green

Write-Host "Creating Better Auth tables..." -ForegroundColor Cyan
Push-Location "$root\frontend"
$env:DATABASE_URL = "postgresql://postgres:$encoded@localhost:5432/rankwise"
npx -y auth@1.7.10 migrate --config src/lib/auth.ts --yes
$authExit = $LASTEXITCODE
Pop-Location
if ($authExit -ne 0) { Write-Host "Better Auth migration failed (see above)." -ForegroundColor Red; exit 1 }

Write-Host "Creating app tables..." -ForegroundColor Cyan
Push-Location "$root\backend"
Remove-Item Env:DATABASE_URL  # backend reads its own .env (asyncpg URL)
if (-not (Get-ChildItem alembic\versions -Filter *.py -ErrorAction SilentlyContinue)) {
  .\.venv\Scripts\alembic revision --autogenerate -m "initial schema"
}
.\.venv\Scripts\alembic upgrade head
$alembicExit = $LASTEXITCODE
Pop-Location
Remove-Item Env:PGPASSWORD
if ($alembicExit -ne 0) { Write-Host "App migration failed (see above)." -ForegroundColor Red; exit 1 }

Write-Host "`nDone. Restart the backend and frontend, then sign up at http://localhost:3000/signup" -ForegroundColor Green
Write-Host "For scheduled audits, alerts and broken-link checks, also start the worker in its own window:" -ForegroundColor Green
Write-Host "  cd backend; .\.venv\Scripts\python -m app.worker"
