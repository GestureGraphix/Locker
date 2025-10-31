#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/scripts/nutrislice-utils.sh"

# Usage: ./get_all_nutrition.sh [school-slug]
# Example: ./get_all_nutrition.sh branford-college

SCHOOL_SLUG="${SCHOOL_SLUG:-jonathan-edwards-college}"
if (($# > 0)); then
  SCHOOL_SLUG="$1"
fi

MENU_TYPE="${MENU_TYPE:-dinner}"
DATE="${DATE:-2025-10-09}"

declare -A LOCATION_OVERRIDES=(
  ["jonathan-edwards-college"]="57753"
)

LOCATION_ID="${LOCATION_ID:-}"
if [[ -z "$LOCATION_ID" ]]; then
  if ! LOCATION_ID="$(nutrislice_resolve_location_id "$SCHOOL_SLUG" "${LOCATION_OVERRIDES[$SCHOOL_SLUG]:-}")"; then
    LOCATION_ID=""
  fi
fi

if [[ -z "$LOCATION_ID" ]]; then
  echo "ERROR: Unable to determine location id for ${SCHOOL_SLUG}" >&2
  echo "Provide LOCATION_ID manually or ensure the locations directory is reachable." >&2
  exit 1
fi

echo "Using location-id ${LOCATION_ID} for ${SCHOOL_SLUG}" >&2

YEAR="${DATE:0:4}"
MONTH="${DATE:5:2}"
DAY="${DATE:8:2}"

API_BASE="${NUTRISLICE_API_BASE}"
weekly_url="${API_BASE}/weeks/school/${SCHOOL_SLUG}/menu-type/${MENU_TYPE}/${YEAR}/${MONTH}/${DAY}/?format=json"

weekly_resp="$(nutrislice_curl_json "$weekly_url" || true)"

if ! jq -e . >/dev/null 2>&1 <<<"$weekly_resp"; then
  echo "ERROR: Weekly endpoint did not return JSON" >&2
  exit 1
fi

# Make a temp map of id -> name, serving
declare -A NAME_MAP
declare -A SERVE_MAP

while IFS=$'\t' read -r id name serving; do
  NAME_MAP[$id]="$name"
  SERVE_MAP[$id]="$serving"
done < <(
  echo "$weekly_resp" \
  | jq -r --arg d "$DATE" '
      .days[] | select(.date==$d) | .menu_items[] |
      [(.id // .menu_item.id),
       (.menu_item.name // .name // ""),
       (.menu_item.serving_size // .portion_display_name // "")]
      | @tsv'
)

ids=$(printf "%s\n" "${!NAME_MAP[@]}" | sort -u)

echo "id,name,serving_size,calories,protein_g,sodium_mg,fat_g,carbs_g,source"

for id in $ids; do
  item_url="${API_BASE}/menu-items/${id}/order-settings/?location-id=${LOCATION_ID}&menu-date=${DATE}"

  resp="$(nutrislice_curl_json "$item_url" || true)"

  if ! jq -e . >/dev/null 2>&1 <<<"$resp"; then
    echo "\"$id\",\"${NAME_MAP[$id]}\",\"${SERVE_MAP[$id]}\",,,,,bad_response"
    continue
  fi

  echo "$resp" | jq -r --arg idfallback "$id" \
    --arg name "${NAME_MAP[$id]}" \
    --arg serving "${SERVE_MAP[$id]}" '
    def csvsafe($s): if $s==null then "" else ($s|tostring|gsub("\""; "\"\"")) end;

    {
      id: $idfallback,
      name: $name,
      serving_size: $serving,
      calories: (.tax_nutrition_info.calories // .raw_nutrition_info.calories),
      protein_g: (.tax_nutrition_info.g_protein // .raw_nutrition_info.g_protein),
      sodium_mg: (.tax_nutrition_info.mg_sodium // .raw_nutrition_info.mg_sodium),
      fat_g: (.tax_nutrition_info.g_fat // .raw_nutrition_info.g_fat),
      carbs_g: (.tax_nutrition_info.g_carbs // .raw_nutrition_info.g_carbs),
      source: (if .tax_nutrition_info then "tax" else "raw" end)
    }
    | [
        .id,
        csvsafe(.name),
        csvsafe(.serving_size),
        .calories, .protein_g, .sodium_mg, .fat_g, .carbs_g,
        .source
      ]
    | @csv'
done
