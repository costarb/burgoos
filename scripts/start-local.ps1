[CmdletBinding()]
param(
  [switch]$SkipDatabase,
  [int]$StartupTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runDirectory = Join-Path $repoRoot ".local\run"
$stopScript = Join-Path $PSScriptRoot "stop-local.ps1"

function Get-ListeningProcessId([int]$Port) {
  $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($connection) { return [int]$connection.OwningProcess }
  return $null
}

function Wait-ForPortRelease([int]$Port, [int]$TimeoutSeconds = 10) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    $owner = Get-ListeningProcessId $Port
    if (-not $owner) { return }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$owner" -ErrorAction SilentlyContinue
  $details = if ($process) { "$($process.Name): $($process.CommandLine)" } else { "processo indisponivel" }
  throw "A porta $port continua ocupada pelo PID $owner ($details). O processo nao foi reconhecido como uma instancia segura deste workspace."
}

function Wait-ForApplication([string]$Name, [int]$Port, [System.Diagnostics.Process]$Process) {
  $deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($Process.HasExited) {
      throw "$Name encerrou durante a inicializacao (exit code $($Process.ExitCode)). Consulte $runDirectory."
    }
    if (Get-ListeningProcessId $Port) {
      Write-Host "$Name pronto em http://localhost:$Port (PID raiz $($Process.Id))." -ForegroundColor Green
      return
    }
    Start-Sleep -Milliseconds 500
    $Process.Refresh()
  }
  throw "Timeout aguardando $Name escutar a porta $Port. Consulte $runDirectory."
}

function Start-LocalApplication([string]$Name, [string[]]$Arguments, [int]$Port) {
  $stdout = Join-Path $runDirectory "$Name.log"
  $stderr = Join-Path $runDirectory "$Name.error.log"
  $process = Start-Process -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  $identity = Get-Process -Id $process.Id
  @{
    pid = $process.Id
    startedAtUtc = $identity.StartTime.ToUniversalTime().ToString("O")
    application = $Name
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory "$Name.pid") -Encoding utf8
  Wait-ForApplication $Name $Port $process
}

New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

Write-Host "Encerrando instancias locais anteriores..." -ForegroundColor Cyan
& $stopScript

foreach ($port in @(3000, 3001)) { Wait-ForPortRelease $port }

if (-not $SkipDatabase) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker nao foi encontrado. Instale/inicie o Docker ou execute com -SkipDatabase."
  }
  Write-Host "Garantindo PostgreSQL local..." -ForegroundColor Cyan
  & docker compose up -d postgres
  if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar o PostgreSQL local." }

  Write-Host "Aplicando migracoes pendentes..." -ForegroundColor Cyan
  & npm.cmd exec -- prisma migrate deploy --schema packages/database/prisma/schema.prisma
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar as migracoes do banco local. Verifique DATABASE_URL e o PostgreSQL."
  }
}

try {
  Write-Host "Iniciando API e web..." -ForegroundColor Cyan
  # APP_ROLE defaults to "all" locally so HTTP and durable jobs are both available.
  Start-LocalApplication "api" @("run", "dev", "--workspace", "@burgoos/api") 3001
  Start-LocalApplication "web" @("run", "dev", "--workspace", "@burgoos/web") 3000
} catch {
  Write-Warning $_.Exception.Message
  & $stopScript
  throw
}

Write-Host "Aplicacao local iniciada." -ForegroundColor Green
Write-Host "Web: http://localhost:3000"
Write-Host "API: http://localhost:3001/api"
Write-Host "Logs: $runDirectory"
