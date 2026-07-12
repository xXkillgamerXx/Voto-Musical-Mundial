# Ejecuta la app móvil contra la API de producción.
# No pasa API_BASE_URL → usa https://vote.musicmundial.com/api

Set-Location $PSScriptRoot

if ($args.Count -gt 0) {
  flutter run @args
} else {
  flutter run
}
