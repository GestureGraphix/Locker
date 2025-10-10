#!/usr/bin/env bash
set -euo pipefail

# === CONFIG ===
SCHOOL_SLUG="jonathan-edwards-college"
MENU_TYPE="dinner"
DATE="2025-10-09"
LOCATION_ID="57753"

BASE="https://yaledining.api.nutrislice.com"
ORIGIN="https://yaledining.nutrislice.com"

YEAR="${DATE:0:4}"
MONTH="${DATE:5:2}"
DAY="${DATE:8:2}"

weekly_url="${BASE}/menu/api/weeks/school/${SCHOOL_SLUG}/menu-type/${MENU_TYPE}/${YEAR}/${MONTH}/${DAY}/?format=json"

weekly_resp="$(curl -s "$weekly_url" -H 'Accept: application/json' \
  -H "Origin: ${ORIGIN}" -H "Referer: ${ORIGIN}/" \
  -H 'X-Requested-With: XMLHttpRequest' --compressed || true)"

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
  item_url="${BASE}/menu/api/menu-items/${id}/order-settings/?location-id=${LOCATION_ID}&menu-date=${DATE}"

  resp="$(curl -s "$item_url" \
    -H 'Accept: application/json' \
    -H "Origin: ${ORIGIN}" \
    -H "Referer: ${ORIGIN}/" \
    -H 'X-Requested-With: XMLHttpRequest' \
    --compressed || true)"

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
