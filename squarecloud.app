DISPLAY_NAME=AuraStudio IA
DESCRIPTION=Plataforma para planejamento e produção de conteúdo para redes sociais — clientes de agência (Next.js + backend integrado)
MAIN=next.config.ts
MEMORY=2048
VERSION=recommended
AUTORESTART=true
START=NODE_OPTIONS=--max-old-space-size=1536 npm run build && npm run db:migrate && npm run start
SUBDOMAIN=aurastudio
