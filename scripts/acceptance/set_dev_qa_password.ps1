<#
.SYNOPSIS
  One-time: give the dedicated DEV/ALPHA QA account a fresh strong password through the
  canonical Supabase Auth admin API, and store it only in the local DPAPI credential store.

.DESCRIPTION
  msljivic031+uskoci-qa@gmail.com is a dedicated acceptance identity, not a personal account.
  Its old password was random and lived only in a DPAPI file that no longer exists, so nobody
  holds it. This script mints a new one, hands it to Supabase Auth through the admin API so
  GoTrue does the hashing, then proves it by performing the ordinary password grant the app uses.

  Nothing secret is printed, echoed, committed or passed on a command line:
    - the project service key is read from the already authenticated Supabase CLI into a variable;
    - the generated password lives in memory and then inside a DPAPI-encrypted file that only this
      Windows user on this machine can decrypt;
    - artifacts/ is git-ignored, so the store can never reach the repository.

  Runs on Windows PowerShell 5.1 and on PowerShell 7.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\acceptance\set_dev_qa_password.ps1 -RotateQaPassword
#>
param([switch]$RotateQaPassword)

$ErrorActionPreference = 'Stop'
if (-not $RotateQaPassword) { throw 'Explicit -RotateQaPassword is required.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$projectRef  = 'leqcwgzvjsxugfgzdmth'
$url         = "https://$projectRef.supabase.co"
$qaEmail     = 'msljivic031+uskoci-qa@gmail.com'
$qaAccount   = '2e7310cf-1887-4378-8e1d-825566419290'
$publishable = 'sb_publishable_o_I-YOn57oPCrIboF0OjPQ_c3DHmOZW'

$repo  = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$store = Join-Path $repo 'artifacts\dev-alpha-qa'
New-Item -ItemType Directory -Force -Path $store | Out-Null
$credentialPath = 'artifacts/dev-alpha-qa/qa-credential.clixml'
Push-Location $repo
try { $ignored = (& git check-ignore $credentialPath) } finally { Pop-Location }
if ($ignored -ne $credentialPath) { throw "$credentialPath is not git-ignored; refusing to write a credential there." }

function Write-Utf8([string]$Path, [string]$Text) {
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}
function Invoke-Api([string]$Uri, [string]$Method, [hashtable]$Headers, [string]$Body) {
  try {
    $request = @{ Uri = $Uri; Method = $Method; Headers = $Headers; UseBasicParsing = $true; MaximumRedirection = 0; TimeoutSec = 30 }
    if ($Method -notin @('Get', 'Head')) { $request.ContentType = 'application/json'; $request.Body = $Body }
    $response = Invoke-WebRequest @request
    return @{ status = [int]$response.StatusCode; content = $response.Content }
  } catch [Net.WebException] {
    $webResponse = $_.Exception.Response
    if ($null -eq $webResponse) { throw }
    $reader = New-Object IO.StreamReader($webResponse.GetResponseStream())
    $content = $reader.ReadToEnd(); $reader.Close()
    return @{ status = [int]$webResponse.StatusCode; content = $content }
  }
}

$serviceKey = $null
$password   = $null
$receipt = [ordered]@{ operation = 'DEV_QA_PASSWORD_ROTATION'; projectRef = $projectRef; account = $qaAccount; startedAt = [DateTime]::UtcNow.ToString('o') }

try {
  # 1. Service key from the authenticated CLI. Captured into a variable, never displayed.
  $keysJson = & npx --no-install supabase projects api-keys --project-ref $projectRef --output json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $keysJson) { throw 'Supabase CLI could not return project API keys. Run: npx supabase login' }
  $serviceKey = (($keysJson | ConvertFrom-Json) | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1).api_key
  if ([string]::IsNullOrWhiteSpace($serviceKey)) { throw 'No service_role key returned by the CLI.' }

  # 2. Confirm the dedicated account before changing any Auth record.
  $existing = Invoke-Api "$url/auth/v1/admin/users/$qaAccount" 'Get' @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } $null
  $receipt.preflightStatus = $existing.status
  if ($existing.status -ne 200) { throw "Auth admin could not read the QA account (HTTP $($existing.status))." }
  $existingUser = $existing.content | ConvertFrom-Json
  if ($existingUser.id -ne $qaAccount -or $existingUser.email -ne $qaEmail) {
    throw 'Auth admin QA account ID/email do not match the dedicated acceptance identity.'
  }
  $receipt.qaIdentityMatched = $true

  # 3. A strong random password from an unambiguous alphabet.
  $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_'
  $bytes = New-Object byte[] 48
  $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })

  # 4. Canonical Auth admin mechanism: GoTrue sets and hashes the password itself.
  $admin = Invoke-Api "$url/auth/v1/admin/users/$qaAccount" 'Put' @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } (@{ password = $password } | ConvertTo-Json -Compress)
  $receipt.adminStatus = $admin.status
  if ($admin.status -ne 200) { throw "Auth admin rejected the password update with HTTP $($admin.status)." }
  $updated = $admin.content | ConvertFrom-Json
  if ($updated.id -ne $qaAccount -or $updated.email -ne $qaEmail) { throw 'Auth admin answered for a different account.' }
  $receipt.emailConfirmed = [bool]$updated.email_confirmed_at

  # 5. Prove it through the ordinary user flow, the same grant the app performs.
  $login = Invoke-Api "$url/auth/v1/token?grant_type=password" 'Post' @{ apikey = $publishable } (@{ email = $qaEmail; password = $password } | ConvertTo-Json -Compress)
  $receipt.loginStatus = $login.status
  if ($login.status -ne 200) { throw "Password grant failed with HTTP $($login.status)." }
  $session = $login.content | ConvertFrom-Json
  if ($session.user.id -ne $qaAccount -or -not $session.access_token) { throw 'Password grant returned an unexpected session.' }
  $receipt.verifiedRealUserSession = $true

  # 6. DPAPI store, decryptable only by this Windows user on this machine.
  $secure = ConvertTo-SecureString -String $password -AsPlainText -Force
  $credential = New-Object Management.Automation.PSCredential($qaEmail, $secure)
  $credential | Export-Clixml -LiteralPath (Join-Path $store 'qa-credential.clixml')
  Write-Utf8 (Join-Path $store 'public-auth-config.json') (@{ url = $url; publishableKey = $publishable; account = $qaAccount; email = $qaEmail } | ConvertTo-Json)
  $receipt.credentialStored = 'artifacts/dev-alpha-qa/qa-credential.clixml'
  $receipt.outcome = 'QA_PASSWORD_ROTATED_AND_STORED'
}
catch { $receipt.outcome = 'FAILED'; $receipt.error = $_.Exception.Message }
finally {
  $serviceKey = $null; $password = $null; $session = $null; $secure = $null; $credential = $null
  [GC]::Collect()
  $receipt.finishedAt = [DateTime]::UtcNow.ToString('o')
  Write-Utf8 (Join-Path $store 'password-rotation-receipt.json') ($receipt | ConvertTo-Json -Depth 4)
}

# Only non-secret facts reach the console.
$receipt | ConvertTo-Json -Depth 4 -Compress
if ($receipt.outcome -ne 'QA_PASSWORD_ROTATED_AND_STORED') { exit 1 }
