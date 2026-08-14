[CmdletBinding()]
param(
  [switch]$StopDatabase
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runDirectory = Join-Path $repoRoot ".local\run"
$currentProcessId = $PID

function Get-ProcessTable {
  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
}

function Add-Descendants(
  [System.Collections.Generic.HashSet[int]]$Targets,
  [object[]]$Processes
) {
  do {
    $added = $false
    foreach ($process in $Processes) {
      $id = [int]$process.ProcessId
      $parentId = [int]$process.ParentProcessId
      if ($id -ne $currentProcessId -and $Targets.Contains($parentId) -and $Targets.Add($id)) {
        $added = $true
      }
    }
  } while ($added)
}

function Test-WorkspaceApplication([object]$Process) {
  $command = [string]$Process.CommandLine
  if (-not $command) { return $false }
  $normalized = $command.Replace("/", "\")
  $inWorkspace = $normalized.IndexOf($repoRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
  $appMarker = $normalized -match "apps[\\/](api|web)" -or
    $normalized -match "@burgoos/(api|web)" -or
    $normalized -match "node_modules[\\/]next[\\/]" -or
    $normalized -match "[\\/]\.next[\\/]" -or
    $normalized -match "next-server" -or
    $normalized -match "node_modules[\\/](ts-node|tsconfig-paths)[\\/]" -or
    $normalized -match "src[\\/]main\.ts" -or
    $normalized -match "(next|ts-node)(\.cmd)?\s+.*dev"
  return $inWorkspace -and $appMarker
}

$processes = Get-ProcessTable
$targets = [System.Collections.Generic.HashSet[int]]::new()

if (Test-Path -LiteralPath $runDirectory) {
  foreach ($pidFile in Get-ChildItem -LiteralPath $runDirectory -Filter "*.pid" -File) {
    try {
      $metadata = Get-Content -LiteralPath $pidFile.FullName -Raw | ConvertFrom-Json
      $trackedId = [int]$metadata.pid
      $tracked = Get-Process -Id $trackedId -ErrorAction SilentlyContinue
      if ($tracked -and $tracked.StartTime.ToUniversalTime().ToString("O") -eq [string]$metadata.startedAtUtc) {
        [void]$targets.Add($trackedId)
      }
    } catch {
      Write-Warning "Ignorando PID file invalido: $($pidFile.FullName)"
    }
  }
}

foreach ($process in $processes) {
  if (Test-WorkspaceApplication $process) { [void]$targets.Add([int]$process.ProcessId) }
}

Add-Descendants $targets $processes

if ($targets.Count -eq 0) {
  Write-Host "Nenhuma instancia local da API/web encontrada."
} else {
  $orderedTargets = @($targets) | Sort-Object -Descending
  Write-Host "Encerrando processos locais: $($orderedTargets -join ', ')" -ForegroundColor Cyan
  foreach ($processId in $orderedTargets) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 500
  $remaining = @($orderedTargets | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
  if ($remaining.Count -gt 0) {
    throw "Nao foi possivel encerrar os PIDs: $($remaining -join ', ')."
  }
}

if (Test-Path -LiteralPath $runDirectory) {
  Get-ChildItem -LiteralPath $runDirectory -Filter "*.pid" -File | Remove-Item -Force
}

if ($StopDatabase) {
  Write-Host "Encerrando PostgreSQL local..." -ForegroundColor Cyan
  Push-Location $repoRoot
  try {
    & docker compose down
    if ($LASTEXITCODE -ne 0) { throw "Falha ao encerrar o Docker Compose local." }
  } finally {
    Pop-Location
  }
}

Write-Host "Aplicacoes locais encerradas." -ForegroundColor Green
