#!/usr/bin/env bash
# Publica as imagens do passe do Google Wallet (card-service/assets) num bucket público do Cloud
# Storage, de onde o Google as baixa (README, seção "Google Cloud: imagens do passe").
#
#   scripts/gcp-wallet-assets.sh [-p <projeto>] [-b <bucket>] [-l <região>]
#
# <projeto>: ID do projeto no Google Cloud (padrão: comunidade-cairbar-512319).
# <bucket>: nome do bucket (padrão: <projeto>-wallet-assets). Só a marca, sem dado pessoal: o
#   mesmo bucket serve dev/hml/prd.
# <região>: região do bucket, se for criado (padrão: southamerica-east1).
# Cria o bucket (acesso uniforme, leitura pública) se não existir e envia as imagens para
# <bucket>/<hash do conteúdo>/: o Google guarda as imagens em cache pela URL, então imagem nova
# precisa de URL nova. Pode ser repetido; imprime o valor de carteirinha_google_wallet_assets_base_url.
set -euo pipefail

uso() {
    sed -n '5p' "$0" | sed 's/^#   //' >&2
    exit 2
}

PROJETO=comunidade-cairbar-512319
BUCKET=""
REGIAO=southamerica-east1
while getopts "p:b:l:" opt; do
    case $opt in
        p) PROJETO=$OPTARG ;;
        b) BUCKET=$OPTARG ;;
        l) REGIAO=$OPTARG ;;
        *) uso ;;
    esac
done
BUCKET=${BUCKET:-$PROJETO-wallet-assets}

ASSETS="$(cd "$(dirname "$0")/../../card-service/assets" && pwd)"
IMAGENS=("$ASSETS/logo.png" "$ASSETS/wide-logo.png" "$ASSETS/hero.png")   # WALLET_ASSETS em card-service/src/app.ts
for imagem in "${IMAGENS[@]}"; do
    [[ -f $imagem ]] || { echo "Falta $imagem: rode scripts/gerar-imagens-wallet.py em card-service/." >&2; exit 1; }
done
VERSAO=$(cat "${IMAGENS[@]}" | openssl dgst -sha256 -r | cut -c1-12)

if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJETO" >/dev/null 2>&1; then
    echo "Bucket $BUCKET já existe."
else
    gcloud storage buckets create "gs://$BUCKET" --project="$PROJETO" --location="$REGIAO" \
        --uniform-bucket-level-access --no-public-access-prevention
fi

# Falha se a organização impõe a prevenção de acesso público (constraints/storage.publicAccessPrevention).
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --project="$PROJETO" \
    --member=allUsers --role=roles/storage.objectViewer >/dev/null

# Conteúdo nunca muda dentro de uma versão: cache longo.
gcloud storage cp "${IMAGENS[@]}" "gs://$BUCKET/$VERSAO/" --project="$PROJETO" \
    --content-type=image/png --cache-control="public, max-age=31536000, immutable"

BASE="https://storage.googleapis.com/$BUCKET/$VERSAO"
for imagem in "${IMAGENS[@]}"; do
    curl -fsSI "$BASE/$(basename "$imagem")" >/dev/null || { echo "Sem acesso público a $BASE/$(basename "$imagem")" >&2; exit 1; }
done

cat <<EOF

Pronto. Em global_vars/main.yml:
  carteirinha_google_wallet_assets_base_url: "$BASE"
Depois rode playbooks/carteirinha.yml (--ee false). Passes já salvos recebem as imagens quando
forem regravados (novo "Salvar no Google Wallet").
EOF
