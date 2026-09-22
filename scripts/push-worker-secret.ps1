<#
.SYNOPSIS
    Push a secret into the tenx-dma Cloudflare Worker without it ever touching
    the console, the clipboard, a file, or PowerShell history.

.DESCRIPTION
    For TWENTY_API_KEY the value is read straight out of

        $env:USERPROFILE\.claude.json  ->  mcpServers.twenty.headers.Authorization

    a leading "Bearer " is stripped, and the raw value is piped into
    `wrangler secret put` on stdin. The value is never assigned to a variable
    that gets displayed, never written to a temp file, and never echoed.

    For any other secret name the script prompts with Read-Host -AsSecureString,
    so what you type is masked and does not land in history either.

    On success it prints exactly: pushed <NAME>

.PARAMETER Name
    The secret to push. Defaults to TWENTY_API_KEY.

.PARAMETER Environment
    Optional wrangler environment, passed through as --env <value>.
    Aliased to -Env.

.PARAMETER FromClaudeJson
    Force reading from .claude.json even when -Name is not TWENTY_API_KEY.

.EXAMPLE
    pwsh scripts/push-worker-secret.ps1
    pwsh scripts/push-worker-secret.ps1 -Name TURNSTILE_SECRET_KEY
    pwsh scripts/push-worker-secret.ps1 -Name TWENTY_API_KEY -Env staging

.NOTES
    Run this from the repository root. It changes directory into worker/ so
    wrangler picks up worker/wrangler.toml.
#>

[CmdletBinding()]
param(
    [ValidatePattern('^[A-Z][A-Z0-9_]{2,63}$')]
    [string] $Name = 'TWENTY_API_KEY',

    # Named -Environment internally so it cannot shadow the $env: provider,
    # but -Env is the alias you actually type.
    [Alias('Env')]
    [ValidatePattern('^[A-Za-z0-9_-]{1,32}$')]
    [string] $Environment,

    [switch] $FromClaudeJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Locate worker/ relative to this script, so the script works from anywhere.
# --------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerDir = Join-Path (Split-Path -Parent $scriptDir) 'worker'

if (-not (Test-Path -LiteralPath (Join-Path $workerDir 'wrangler.toml'))) {
    throw "Could not find worker/wrangler.toml (looked in '$workerDir'). Run this from the website repo."
}

# --------------------------------------------------------------------------
# Resolve the secret value. Nothing below ever writes the value to output.
# --------------------------------------------------------------------------
function Get-TwentyTokenFromClaudeJson {
    $claudeJson = Join-Path $env:USERPROFILE '.claude.json'

    if (-not (Test-Path -LiteralPath $claudeJson)) {
        throw "Not found: $claudeJson. The Twenty MCP server is configured there; without it this script has no token to push."
    }

    try {
        $config = Get-Content -LiteralPath $claudeJson -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "Could not parse $claudeJson as JSON. Fix the file, then re-run."
    }

    # Walk the path defensively: Set-StrictMode makes a missing property throw,
    # and we want a clear message rather than a property-not-found stack.
    $node = $config
    foreach ($segment in @('mcpServers', 'twenty', 'headers', 'Authorization')) {
        if ($null -eq $node -or -not ($node.PSObject.Properties.Name -contains $segment)) {
            throw "Key mcpServers.twenty.headers.Authorization is missing from $claudeJson (stopped at '$segment'). Add the Twenty MCP server, or pass -Name with a different secret."
        }
        $node = $node.$segment
    }

    if ($node -isnot [string] -or [string]::IsNullOrWhiteSpace($node)) {
        throw "mcpServers.twenty.headers.Authorization in $claudeJson is empty or not a string."
    }

    # Strip a leading "Bearer " (any casing, any run of spaces).
    $token = ($node -replace '^\s*[Bb][Ee][Aa][Rr][Ee][Rr]\s+', '').Trim()

    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "The Authorization header in $claudeJson is just 'Bearer' with no token after it."
    }
    if ($token.Length -lt 16) {
        throw "The token read from $claudeJson is implausibly short. Refusing to push it."
    }

    return $token
}

if ($Name -eq 'TWENTY_API_KEY' -or $FromClaudeJson) {
    $secretValue = Get-TwentyTokenFromClaudeJson
}
else {
    $secure = Read-Host -Prompt "Value for $Name (input is hidden)" -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) {
        throw "No value entered for $Name. Nothing pushed."
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $secretValue = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if ([string]::IsNullOrWhiteSpace($secretValue)) {
        throw "No value entered for $Name. Nothing pushed."
    }
}

# --------------------------------------------------------------------------
# Push it. The value goes to wrangler on stdin only.
# --------------------------------------------------------------------------
$wranglerArgs = @('wrangler', 'secret', 'put', $Name)
if (-not [string]::IsNullOrWhiteSpace($Environment)) {
    $wranglerArgs += @('--env', $Environment)
}

Push-Location -LiteralPath $workerDir
try {
    # Piping keeps the value off the command line, out of the process table,
    # and out of PSReadLine history. stdout/stderr from wrangler is left alone
    # so a real failure is still visible.
    $secretValue | & npx --yes @wranglerArgs

    if ($LASTEXITCODE -ne 0) {
        throw "wrangler exited with code $LASTEXITCODE. $Name was not pushed."
    }
}
finally {
    Pop-Location
    # Best effort: drop the reference so it is not sitting in the session.
    $secretValue = $null
    Remove-Variable -Name secretValue -ErrorAction SilentlyContinue
    [System.GC]::Collect()
}

Write-Output "pushed $Name"
