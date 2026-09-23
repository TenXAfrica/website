# Build the site and publish it to the review preview on workers.dev.
# Never deploys the live site: production is GitHub Pages from main.
#
# Uses the Worker's own pinned wrangler (worker/node_modules) with an explicit
# --config, because a global wrangler run from the repo root rewrites the
# Astro project.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

# Keep the preview out of search results. Written into dist/ only, so the
# production build on GitHub Pages is unaffected.
@"
/*
  X-Robots-Tag: noindex, nofollow
"@ | Set-Content -Path (Join-Path $root 'dist/_headers') -Encoding ascii

node worker/node_modules/wrangler/bin/wrangler.js deploy --config preview/wrangler.toml
if ($LASTEXITCODE -ne 0) { throw 'Preview deploy failed' }
