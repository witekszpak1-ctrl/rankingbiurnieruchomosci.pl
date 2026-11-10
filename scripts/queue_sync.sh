#!/usr/bin/env bash
# Synchronizacja kolejki dla Claude Code z gałęzią queue-data tego samego repozytorium.
# Gałąź nie ma wspólnej historii z main, trzyma tylko katalog queue/ (paczki i wyniki).
#
#   queue_sync.sh push-pending   kopiuje queue/pending na gałąź (istniejących plików nie nadpisuje)
#   queue_sync.sh push-results   kopiuje queue/results na gałąź (nadpisuje)
#   queue_sync.sh push-candidates kopiuje queue/candidates (wyniki wyszukiwania zebrane przez Claude Code) na gałąź
#   queue_sync.sh pull           pobiera całą gałąź do ./queue (nadpisuje lokalne pliki o tych samych nazwach)
#
# Zmienne: QUEUE_BRANCH (domyślnie queue-data), QUEUE_REMOTE (domyślnie origin).
set -euo pipefail

BRANCH="${QUEUE_BRANCH:-queue-data}"
REMOTE="${QUEUE_REMOTE:-origin}"
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
  echo "Wysłano na gałąź $BRANCH."
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
  push-results)
    push_with_retry results "queue: wyniki ($(date -u +%Y-%m-%dT%H:%MZ))"
    ;;
  push-candidates)
    push_with_retry candidates "queue: kandydaci ($(date -u +%Y-%m-%dT%H:%MZ))"
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
    echo "Pobrano kolejkę z gałęzi $BRANCH do ./queue."
    ;;
  *)
    echo "Użycie: $0 {push-pending|push-results|push-candidates|pull}" >&2
    exit 2
    ;;
esac
