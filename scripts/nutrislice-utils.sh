#!/usr/bin/env bash

# Shared helpers for interacting with the Nutrislice menu API.
# These helpers intentionally avoid setting shell options so that they can be sourced safely.

: "${NUTRISLICE_API_BASE:=https://yaledining.api.nutrislice.com/menu/api}"
: "${NUTRISLICE_ORIGIN:=https://yaledining.nutrislice.com}"
: "${NUTRISLICE_USER_AGENT:=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36}"

# Cache of the locations directory payload so that repeated lookups don't fan out multiple requests.
__nutrislice_location_directory_cache="${__nutrislice_location_directory_cache:-}"

nutrislice_normalize_slug() {
  local value="${1:-}"
  # shellcheck disable=SC2001
  value="$(printf '%s' "$value" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')"
  printf '%s' "$value"
}

nutrislice_curl_json() {
  local url="$1"
  curl -s "$url" \
    -H 'Accept: application/json' \
    -H 'X-Requested-With: XMLHttpRequest' \
    -H "Origin: ${NUTRISLICE_ORIGIN}" \
    -H "Referer: ${NUTRISLICE_ORIGIN}/" \
    -H "User-Agent: ${NUTRISLICE_USER_AGENT}" \
    --compressed
}

nutrislice_resolve_location_id() {
  local slug="$1"
  local fallback="${2:-}"

  local normalized
  normalized="$(nutrislice_normalize_slug "$slug")"
  if [[ -z "$normalized" ]]; then
    if [[ -n "$fallback" ]]; then
      printf '%s' "$fallback"
      return 0
    fi
    return 1
  fi

  if [[ -z "$__nutrislice_location_directory_cache" ]]; then
    __nutrislice_location_directory_cache="$(nutrislice_curl_json "${NUTRISLICE_API_BASE}/locations/?format=json" || true)"
  fi

  local directory_json
  directory_json="${__nutrislice_location_directory_cache}";

  if [[ -n "$directory_json" ]] && jq -e . >/dev/null 2>&1 <<<"$directory_json"; then
    local resolved
    resolved="$(jq -r --arg target "$normalized" '
      def norm($v):
        if $v == null then empty
        else
          ($v | tostring | ascii_downcase
              | gsub("[^a-z0-9]+"; "-")
              | gsub("-+"; "-")
              | gsub("^-|-$"; ""))
          | select(length > 0)
        end;
      def arrnorm($arr):
        if $arr | type == "array" then
          [$arr[] | norm(.)]
        else [] end;
      def pathnorm($v):
        if $v == null then []
        else ($v | tostring | split("/") | map(norm(.)) | map(select(length > 0))) end;

      map(
        . as $loc
        | {
            id: (if ($loc.id | type) == "number" then ($loc.id | tostring)
                  elif ($loc.id | type) == "string" and ($loc.id | test("^[0-9]+$")) then ($loc.id | tostring)
                  else empty end),
            candidates: (
              (
                [ norm($loc.slug), norm($loc.school_slug), norm($loc.menu_group_slug), norm($loc.school) ]
                + pathnorm($loc.path)
                + arrnorm($loc.slugs)
                + arrnorm($loc.school_slugs)
                + arrnorm($loc.schools)
              )
              | map(select(. != null))
              | unique
            )
          }
        | select(.id != null)
        | select(.candidates | index($target))
        | .id
      )
      | first
    ' <<<"$directory_json")"

    if [[ -n "$resolved" && "$resolved" != "null" ]]; then
      printf '%s' "$resolved"
      return 0
    fi
  fi

  if [[ -n "$fallback" ]]; then
    printf '%s' "$fallback"
    return 0
  fi

  return 1
}
