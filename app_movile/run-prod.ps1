# Ejecuta la app móvil contra la API de producción.
# No pasa API_BASE_URL → usa https://vote.musicmundial.com/api
# GIPHY: usa $env:GIPHY_API_KEY, $env:VITE_GIPHY_API_KEY o .env del repo.

Set-Location $PSScriptRoot

function Get-GiphyApiKey {
  if ($env:GIPHY_API_KEY) { return $env:GIPHY_API_KEY }
  if ($env:VITE_GIPHY_API_KEY) { return $env:VITE_GIPHY_API_KEY }

  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*VITE_GIPHY_API_KEY\s*=' } | Select-Object -First 1
    if ($line) {
      return ($line -replace '^\s*VITE_GIPHY_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
    }
  }

  return $null
}

$flutterArgs = @()
$giphyKey = Get-GiphyApiKey
if ($giphyKey) {
  $flutterArgs += "--dart-define=GIPHY_API_KEY=$giphyKey"
}

if ($args.Count -gt 0) {
  flutter run @flutterArgs @args
} else {
  flutter run @flutterArgs
}
