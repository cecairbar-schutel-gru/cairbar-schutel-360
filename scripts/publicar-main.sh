#!/usr/bin/env bash
# Publica na branch main os commits da branch dev, trocando dados sensíveis (IPs das
# VMs) conforme .publicar/substituicoes.txt. A dev é só local e nunca é alterada; a
# main é montada por plumbing (sem tocar a working tree) e é a única que vai ao remoto.
#
# Uso: scripts/publicar-main.sh   (depois: git push origin main)
#
# Cada commit novo da dev (first-parent) vira um commit na main, com o mesmo autor,
# datas e mensagem. O último commit da dev publicado fica em refs/publicar/ultimo-dev.
# Não faça commits direto na main: a próxima publicação os sobrescreve com a árvore da dev.
set -euo pipefail

ORIGEM=dev
DESTINO=main
MARCADOR=refs/publicar/ultimo-dev

raiz=$(git rev-parse --show-toplevel)
mapa="$raiz/.publicar/substituicoes.txt"
[ -s "$mapa" ] || { echo "Mapa de substituições não encontrado: $mapa" >&2; exit 1; }

if [ "$(git symbolic-ref -q --short HEAD)" = "$DESTINO" ]; then
    echo "Faça checkout da $ORIGEM antes de publicar (a $DESTINO é reescrita por este script)." >&2
    exit 1
fi

# Guarda de push (só main, nunca com os valores reais).
git config core.hooksPath scripts/git-hooks

padroes=$(mktemp)
indice=$(mktemp -u)
trap 'rm -f "$padroes" "$indice"' EXIT
sed -n 's/^\([^#].*\)==>.*$/\1/p' "$mapa" > "$padroes"

substituir() {
    perl -e '
        open my $m, "<", $ARGV[0] or die;
        while (<$m>) { chomp; next if /^\s*(#|$)/; push @r, [split /==>/, $_, 2] }
        local $/; my $t = <STDIN>;
        $t =~ s/\Q$$_[0]\E/$$_[1]/g for @r;
        print $t;
    ' "$mapa"
}

if base=$(git rev-parse -q --verify "$MARCADOR"); then
    git merge-base --is-ancestor "$base" "$ORIGEM" || {
        echo "$MARCADOR ($base) não está na história da $ORIGEM (rebase/reset?)." >&2
        exit 1
    }
    pai=$(git rev-parse "$DESTINO")
    commits=$(git rev-list --reverse --first-parent "$base..$ORIGEM")
else
    # Primeira publicação: a main é refeita do zero a partir da história da dev.
    pai=
    commits=$(git rev-list --reverse --first-parent "$ORIGEM")
fi

if [ -z "$commits" ]; then
    echo "Nada a publicar: a $DESTINO já está em dia com a $ORIGEM."
    exit 0
fi

for c in $commits; do
    GIT_INDEX_FILE=$indice git read-tree "$c"
    { git grep -z -l -I -F -f "$padroes" "$c" || true; } | while IFS= read -r -d '' arq; do
        arq=${arq#"$c":}
        read -r modo _ blob _ < <(git ls-tree "$c" -- "$arq")
        novo=$(git cat-file blob "$blob" | substituir | git hash-object -w --stdin)
        GIT_INDEX_FILE=$indice git update-index --cacheinfo "$modo,$novo,$arq"
    done
    arvore=$(GIT_INDEX_FILE=$indice git write-tree)

    export GIT_AUTHOR_NAME=$(git log -1 --format=%an "$c")
    export GIT_AUTHOR_EMAIL=$(git log -1 --format=%ae "$c")
    export GIT_AUTHOR_DATE=$(git log -1 --format=%ad --date=raw "$c")
    export GIT_COMMITTER_NAME=$(git log -1 --format=%cn "$c")
    export GIT_COMMITTER_EMAIL=$(git log -1 --format=%ce "$c")
    export GIT_COMMITTER_DATE=$(git log -1 --format=%cd --date=raw "$c")
    pai=$(git log -1 --format=%B "$c" | substituir | git commit-tree "$arvore" ${pai:+-p "$pai"})
    echo "$(git log -1 --format='%h %s' "$c") -> $(git rev-parse --short "$pai")"
done

if git grep -q -I -F -f "$padroes" "$pai" || git log --format=%B "$pai" | grep -q -F -f "$padroes"; then
    echo "Valores reais ainda presentes no resultado; $DESTINO não foi alterada." >&2
    exit 1
fi

git update-ref -m "publicar-main: $ORIGEM -> $DESTINO" "refs/heads/$DESTINO" "$pai"
git update-ref "$MARCADOR" "$c"
echo "$DESTINO atualizada. Confira com 'git log $DESTINO' e envie com: git push origin $DESTINO"
