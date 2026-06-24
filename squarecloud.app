DISPLAY_NAME=AuraGrid IA
DESCRIPTION=Planejamento de Instagram para marcas de moda com IA (Next.js + backend integrado)
MAIN=next.config.ts
MEMORY=2048
VERSION=recommended
AUTORESTART=true
START=NODE_OPTIONS=--max-old-space-size=1536 npm run build && npm run start
SUBDOMAIN=auragrid
