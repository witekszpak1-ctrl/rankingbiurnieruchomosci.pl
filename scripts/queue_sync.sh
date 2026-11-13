#!/usr/bin/env bash
# Synchronizacja kolejki dla Claude Code z gałęzią queue-data osobnego, prywatnego repozytorium
# witekszpak1-ctrl/rankingbiur-kolejka. Paczki zawierają teksty ze stron biur (czasem imiona, nazwiska i e-maile
# właścicieli), więc nie mogą leżeć w publicznym repozytorium z kodem. Gałąź trzyma tylko katalog queue/.
#
#   queue_sync.sh push-pending   kopiuje queue/pending na gałąź (istniejących plików nie nadpisuje)
#   queue_sync.sh push-results   kopiuje queue/results na gałąź (nadpisuje)
#   queue_sync.sh push-prompts   kopiuje queue/prompts (prompt opisów z panelu) na gałąź
#   queue_sync.sh push-candidates kopiuje queue/candidates (wyniki wyszukiwania zebrane przez Claude Code) na gałąź
#   queue_sync.sh push-cities    kopiuje queue/cities.json (kolejka miast z panelu) na gałąź (nadpisuje)
#   queue_sync.sh pull           pobiera całą gałąź do ./queue (nadpisuje lokalne pliki o tych samych nazwach)
#
# Zmienne: QUEUE_BRANCH (domyślnie queue-data), QUEUE_REPO_URL (adres repozytorium kolejki),
# QUEUE_REPO_TOKEN (token z prawem zapisu do repozytorium kolejki; w GitHub Actions z sekretu o tej nazwie,
# w sesji Claude Code niepotrzebny, bo dostęp daje proxy sesji), QUEUE_REMOTE (zamiast adresu, np. origin).
set -euo pipefail

BRANCH="${QUEUE_BRANCH:-queue-data}"
QUEUE_REPO_URL="${QUEUE_REPO_URL:-https://github.com/witekszpak1-ctrl/rankingbiur-kolejka.git}"
if [ -n "${QUEUE_REMOTE:-}" ]; then
  REMOTE="$QUEUE_REMOTE"
elif [ -n "${QUEUE_REPO_TOKEN:-}" ]; then
  REMOTE="https://x-access-token:${QUEUE_REPO_TOKEN}@${QUEUE_REPO_URL#https://}"
  # actions/checkout zostawia nagłówek z tokenem repozytorium z kodem dla całego github.com; przykryłby on
  # token kolejki, więc pusta wartość czyści listę nagłówków (tylko dla poleceń git tego skryptu).
  export GIT_CONFIG_COUNT=2
  export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader" GIT_CONFIG_VALUE_0=""
  export GIT_CONFIG_KEY_1="http.extraheader" GIT_CONFIG_VALUE_1=""
else
  REMOTE="$QUEUE_REPO_URL"
fi
if [ -n "${GITHUB_ACTIONS:-}" ] && [ -z "${QUEUE_REPO_TOKEN:-}" ] && [ -z "${QUEUE_REMOTE:-}" ]; then
  echo "Brak sekretu QUEUE_REPO_TOKEN: automat nie ma dostępu do repozytorium kolejki (token wygasł albo go usunięto)." >&2
  exit 1
fi
cmd="${1:-}"

cd "$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$tmp" >/dev/null 2>&1 || rm -rf "$tmp"
  git worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

reset_tmp() {
  git worktree remove --force "$tmp" >/dev/null 2>&1 || rm -rf "$tmp"
  git worktree prune >/dev/null 2>&1 || true
  mkdir -p "$tmp"
}

# Kopiuje pliki z $1 do $2, nie nadpisując istniejących (przenośnie, bez cp -n).
copy_no_clobber() {
  local src="$1" dst="$2" f
  while IFS= read -r f; do
    if [ ! -e "$dst/$f" ]; then
      mkdir -p "$(dirname "$dst/$f")"
      cp "$src/$f" "$dst/$f"
    fi
  done < <(cd "$src" && find . -type f | sed 's#^\./##')
}

branch_exists() {
  git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1
}

# Przygotowuje katalog roboczy z aktualnym stanem gałęzi (albo pustą gałąź sierocą, gdy jeszcze nie istnieje).
checkout_branch() {
  if branch_exists; then
    git fetch -q --depth=1 "$REMOTE" "$BRANCH"
    git worktree add -q --detach "$tmp" FETCH_HEAD
  else
    git worktree add -q --detach "$tmp" HEAD
    git -C "$tmp" checkout -q --orphan "$BRANCH"
    git -C "$tmp" rm -rfq .
  fi
}

commit_and_push() {
  git -C "$tmp" add -f -A queue 2>/dev/null || true
  if git -C "$tmp" diff --cached --quiet; then
    echo "Brak zmian do wysłania."
    return 0
  fi
  git -C "$tmp" -c user.name="katalog-bot" -c user.email="katalog-bot@users.noreply.github.com" \
    commit -q -m "$1"
  git -C "$tmp" push -q "$REMOTE" "HEAD:refs/heads/$BRANCH"
  echo "Wysłano do kolejki ($BRANCH)."
}

push_with_retry() {
  local kind="$1" message="$2" attempt
  for attempt in 1 2 3; do
    reset_tmp
    checkout_branch
    mkdir -p "$tmp/queue/$kind"
    if [ -d "queue/$kind" ]; then
      if [ "$kind" = "pending" ]; then
        copy_no_clobber "queue/$kind" "$tmp/queue/$kind"
      else
        cp -r "queue/$kind/." "$tmp/queue/$kind/"
      fi
    fi
    if commit_and_push "$message"; then
      return 0
    fi
    echo "Wysyłka nieudana (próba $attempt z 3), ponawiam."
    sleep 2
  done
  echo "Nie udało się wysłać kolejki." >&2
  return 1
}

case "$cmd" in
  push-pending)
    push_with_retry pending "queue: nowe paczki ($(date -u +%Y-%m-%dT%H:%MZ))"
    ;;
  push-prompts)
    push_with_retry prompts "queue: prompt opisów z panelu ($(date -u +%Y-%m-%dT%H:%MZ))"
    ;;
  push-results)
    push_with_retry results "queue: wyniki ($(date -u +%Y-%m-%dT%H:%MZ))"
    ;;
  push-candidates)
    push_with_retry candidates "queue: kandydaci ($(date -u +%Y-%m-%dT%H:%MZ))"
    ;;
  push-cities)
    for attempt in 1 2 3; do
      reset_tmp
      checkout_branch
      mkdir -p "$tmp/queue"
      [ -f queue/cities.json ] && cp queue/cities.json "$tmp/queue/cities.json"
      if commit_and_push "queue: kolejka miast ($(date -u +%Y-%m-%dT%H:%MZ))"; then
        exit 0
      fi
      echo "Wysyłka nieudana (próba $attempt z 3), ponawiam."
      sleep 2
    done
    echo "Nie udało się wysłać kolejki miast." >&2
    exit 1
    ;;
  pull)
    if ! branch_exists; then
      echo "Gałąź $BRANCH jeszcze nie istnieje, nic do pobrania."
      exit 0
    fi
    checkout_branch
    mkdir -p queue
    if [ -d "$tmp/queue" ]; then
      cp -r "$tmp/queue/." queue/
    fi
    echo "Pobrano kolejkę ($BRANCH) do ./queue."
    ;;
  *)
    echo "Użycie: $0 {push-pending|push-results|push-candidates|push-cities|push-prompts|pull}" >&2
    exit 2
    ;;
esac
