#!/usr/bin/env bash
# Workload Identity Federation do Google Cloud com o realm cecairbar como provedor OIDC
# (README, seção "Google Cloud: Workload Identity Federation"; ADR 0002).
#
#   scripts/gcp-workload-identity.sh configurar     -H <host> [-a dev|qas|hml|prd] [-p <projeto>] [-c <conta>]
#   scripts/gcp-workload-identity.sh excluir-chaves [-p <projeto>] [-c <conta>]
#
# Ambiente padrão: dev (pool cecairbar-dev, o ambiente da VM atual). Use -a para qas/hml/prd, sempre com o host daquele
# ambiente — cada um tem seu próprio Keycloak e seu próprio pool.
# <projeto>: ID do projeto no Google Cloud (padrão: comunidade-cairbar-512319).
# <conta>: conta de serviço do Google Wallet (padrão: keycloak-srv-acc@<projeto>.iam.gserviceaccount.com).
# configurar: habilita as APIs, cria (ou atualiza) pool e provedor e concede ao principal do
# pool roles/iam.serviceAccountTokenCreator na conta de serviço. Pode ser repetido.
# excluir-chaves: exclui as chaves da conta criadas por usuário. Rode só depois de validar
# a emissão no Google Wallet com a federação.
set -euo pipefail

CLIENTE=servico-carteirinha-gcp   # realm_gcp_wif_client.clientId em realm/cecairbar.yml
REALM=cecairbar
PROVEDOR=keycloak

uso() {
    sed -n '5,6p' "$0" | sed 's/^#   //' >&2
    exit 2
}

[[ $# -ge 1 ]] || uso
ACAO=$1
shift

PROJETO=comunidade-cairbar-512319
CONTA=""
HOST=""
AMBIENTE=dev
while getopts "p:c:H:a:" opt; do
    case $opt in
        p) PROJETO=$OPTARG ;;
        c) CONTA=$OPTARG ;;
        H) HOST=$OPTARG ;;
        a) AMBIENTE=$OPTARG ;;
        *) uso ;;
    esac
done
CONTA=${CONTA:-keycloak-srv-acc@$PROJETO.iam.gserviceaccount.com}
[[ $AMBIENTE =~ ^(dev|qas|hml|prd)$ ]] || { echo "Ambiente inválido: $AMBIENTE (dev|qas|hml|prd)" >&2; exit 2; }

POOL=cecairbar-$AMBIENTE

configurar() {
    [[ -n $HOST ]] || uso
    local issuer="https://$HOST/realms/$REALM"

    # O Google baixa discovery e JWKS pela internet: exige certificado válido (letsencrypt).
    echo "Verificando o issuer $issuer..."
    local publicado
    publicado=$(curl -fsS "$issuer/.well-known/openid-configuration" | python3 -c 'import json,sys; print(json.load(sys.stdin)["issuer"])')
    if [[ $publicado != "$issuer" ]]; then
        echo "O discovery publica o issuer '$publicado', esperado '$issuer'." >&2
        exit 1
    fi

    local numero
    numero=$(gcloud projects describe "$PROJETO" --format='value(projectNumber)')

    gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
        --project="$PROJETO"

    if gcloud iam workload-identity-pools describe "$POOL" --project="$PROJETO" --location=global >/dev/null 2>&1; then
        echo "Pool $POOL já existe."
    else
        gcloud iam workload-identity-pools create "$POOL" --project="$PROJETO" --location=global \
            --display-name="Keycloak $REALM ($AMBIENTE)"
    fi

    # Sem --allowed-audiences: vale a audience padrão (https://iam.googleapis.com/projects/...),
    # que é a que o realm põe no token (gcp_wif_audience em global_vars/main.yml).
    local opcoes=(
        --project="$PROJETO" --location=global --workload-identity-pool="$POOL"
        --issuer-uri="$issuer"
        --attribute-mapping="google.subject=assertion.azp"
        --attribute-condition="assertion.azp == '$CLIENTE'"
    )
    if gcloud iam workload-identity-pools providers describe "$PROVEDOR" --project="$PROJETO" \
        --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1; then
        gcloud iam workload-identity-pools providers update-oidc "$PROVEDOR" "${opcoes[@]}"
    else
        gcloud iam workload-identity-pools providers create-oidc "$PROVEDOR" "${opcoes[@]}"
    fi

    # Token Creator cobre a personificação (generateAccessToken) e o signJwt.
    gcloud iam service-accounts add-iam-policy-binding "$CONTA" --project="$PROJETO" \
        --role=roles/iam.serviceAccountTokenCreator \
        --member="principal://iam.googleapis.com/projects/$numero/locations/global/workloadIdentityPools/$POOL/subject/$CLIENTE" \
        >/dev/null

    cat <<EOF

Pronto. Em global_vars/secrets-$AMBIENTE.yml:
  secret_gcp_wif_provider: "projects/$numero/locations/global/workloadIdentityPools/$POOL/providers/$PROVEDOR"
  secret_google_wallet_service_account_email: "$CONTA"
Depois rode playbooks/keycloak-realm.yml e playbooks/carteirinha.yml (--ee false).
EOF
}

excluir_chaves() {
    local chaves
    chaves=$(gcloud iam service-accounts keys list --iam-account="$CONTA" --project="$PROJETO" \
        --managed-by=user --format='value(name.basename())')
    if [[ -z $chaves ]]; then
        echo "A conta $CONTA não tem chaves criadas por usuário."
        return
    fi
    echo "Chaves da conta $CONTA:"
    echo "$chaves" | sed 's/^/  /'
    read -r -p "Excluir todas? A emissão precisa já funcionar pela federação. [digite sim] " resposta
    [[ $resposta == sim ]] || { echo "Nada excluído."; return; }
    while read -r chave; do
        gcloud iam service-accounts keys delete "$chave" --iam-account="$CONTA" --project="$PROJETO" --quiet
    done <<<"$chaves"
    echo "Para impedir novas chaves (exige permissão na organização): constraints/iam.disableServiceAccountKeyCreation"
}

case $ACAO in
    configurar) configurar ;;
    excluir-chaves) excluir_chaves ;;
    *) uso ;;
esac
