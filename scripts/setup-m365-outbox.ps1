param(
  [string]$ProjectRef = "proyrepqqpzerloyydlk",
  [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Fail($msg) {
  Write-Host ""
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

function Prompt-Required([string]$label, [string]$hint = "") {
  while ($true) {
    if ($hint) { Write-Host $hint -ForegroundColor DarkGray }
    $v = Read-Host $label
    if (-not [string]::IsNullOrWhiteSpace($v)) { return $v.Trim() }
    Write-Host "Value required." -ForegroundColor Yellow
  }
}

function Ensure-Cli {
  Write-Step "Checking Supabase CLI"
  try {
    $v = & npx supabase --version
    Write-Host "Supabase CLI: $v" -ForegroundColor Green
  } catch {
    Fail "Could not run 'npx supabase --version'. Make sure Node/npm is installed."
  }
}

function Validate-GuidLike([string]$value, [string]$name) {
  $regex = '^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$'
  if ($value -notmatch $regex) {
    Fail "$name doesn't look like a valid GUID: $value"
  }
}

function Validate-SecretValue([string]$value) {
  # Common mistake: pasting Secret ID (GUID) instead of Secret Value.
  $guidRegex = '^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$'
  if ($value -match $guidRegex) {
    Fail "M365_CLIENT_SECRET looks like a GUID (Secret ID). Paste the Secret VALUE from Entra Certificates & secrets."
  }
  if ($value.Length -lt 20) {
    Fail "M365_CLIENT_SECRET looks too short. Paste the full Secret VALUE."
  }
}

function Validate-Email([string]$value, [string]$name) {
  if ($value -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    Fail "$name doesn't look like an email address: $value"
  }
}

function Set-Secret([string]$name, [string]$value, [string]$projectRef) {
  Write-Host "Setting $name..." -ForegroundColor DarkCyan
  & npx supabase secrets set "$name=$value" --project-ref $projectRef | Out-Null
}

function Deploy-Function([string]$projectRef) {
  Write-Step "Deploying process-appointment-outbox function"
  & npx supabase functions deploy process-appointment-outbox --project-ref $projectRef --no-verify-jwt
}

function Trigger-TestSend([string]$projectRef) {
  Write-Step "Triggering outbox sender function"
  $envPath = Join-Path (Get-Location) ".env"
  if (-not (Test-Path $envPath)) {
    Write-Host ".env not found; skipping live trigger test." -ForegroundColor Yellow
    return
  }

  $anonLine = Get-Content $envPath | Where-Object { $_ -like "VITE_SUPABASE_ANON_KEY=*" } | Select-Object -First 1
  if (-not $anonLine) {
    Write-Host "VITE_SUPABASE_ANON_KEY not found in .env; skipping live trigger test." -ForegroundColor Yellow
    return
  }
  $anonKey = $anonLine.Split("=", 2)[1].Trim()
  if (-not $anonKey) {
    Write-Host "Anon key in .env is empty; skipping live trigger test." -ForegroundColor Yellow
    return
  }

  $uri = "https://$projectRef.supabase.co/functions/v1/process-appointment-outbox"
  try {
    $result = Invoke-RestMethod -Method Post -Uri $uri -Headers @{
      apikey        = $anonKey
      Authorization = "Bearer $anonKey"
      "Content-Type" = "application/json"
    } -Body '{"reason":"guided_setup_script"}'

    Write-Host "Function response:" -ForegroundColor Green
    $result | ConvertTo-Json -Depth 8
  } catch {
    Write-Host "Trigger failed:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host "This often means API permissions/consent or secret values still need correction." -ForegroundColor DarkYellow
  }
}

Ensure-Cli

Write-Step "Collecting Microsoft 365 values"
Write-Host "Paste values from Entra App Registration -> Overview / Certificates & secrets." -ForegroundColor DarkGray

$tenantId = Prompt-Required "M365_TENANT_ID"
$clientId = Prompt-Required "M365_CLIENT_ID"
$clientSecret = Prompt-Required "M365_CLIENT_SECRET (Secret VALUE, not Secret ID)"
$senderUser = Prompt-Required "M365_SENDER_USER (e.g. info@aristonesolicitors.co.uk)"
$replyTo = Read-Host "M365_REPLY_TO (optional, press Enter to reuse sender)"
if ([string]::IsNullOrWhiteSpace($replyTo)) {
  $replyTo = $senderUser
}

Validate-GuidLike $tenantId "M365_TENANT_ID"
Validate-GuidLike $clientId "M365_CLIENT_ID"
Validate-SecretValue $clientSecret
Validate-Email $senderUser "M365_SENDER_USER"
Validate-Email $replyTo "M365_REPLY_TO"

Write-Step "Setting Supabase secrets for project $ProjectRef"
Set-Secret "M365_TENANT_ID" $tenantId $ProjectRef
Set-Secret "M365_CLIENT_ID" $clientId $ProjectRef
Set-Secret "M365_CLIENT_SECRET" $clientSecret $ProjectRef
Set-Secret "M365_SENDER_USER" $senderUser $ProjectRef
Set-Secret "M365_REPLY_TO" $replyTo $ProjectRef

if (-not $SkipDeploy) {
  Deploy-Function $ProjectRef
}

Trigger-TestSend $ProjectRef

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Next: book a test appointment, then check appointment_email_outbox.delivered_at." -ForegroundColor DarkGray

