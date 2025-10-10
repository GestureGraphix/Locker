#!/usr/bin/env bash
set -euo pipefail

# ---------- CONFIG (env overrides welcome) ----------
SCHOOL_SLUG="${SCHOOL_SLUG:-jonathan-edwards-college}"
MENU_TYPE="${MENU_TYPE:-dinner}"          # breakfast|lunch|dinner
DATE="${DATE:-2025-10-09}"                # YYYY-MM-DD
LOCATION_ID="${LOCATION_ID:-57753}"

BASE="https://yaledining.api.nutrislice.com"
ORIGIN="https://yaledining.nutrislice.com"

YEAR="${DATE:0:4}"
MONTH="${DATE:5:2}"
DAY="${DATE:8:2}"

WEEKS_URL="${BASE}/menu/api/weeks/school/${SCHOOL_SLUG}/menu-type/${MENU_TYPE}/${YEAR}/${MONTH}/${DAY}/?format=json"

# ---------- helpers ----------
curl_json () {
  curl -s "$1" \
    -H 'Accept: application/json' \
    -H "Origin: ${ORIGIN}" \
    -H "Referer: ${ORIGIN}/" \
    -H 'X-Requested-With: XMLHttpRequest' \
    --compressed
}

# ---------- 1) Fetch the weeks payload ----------
weekly_resp="$(curl_json "$WEEKS_URL" || true)"

if ! jq -e . >/dev/null 2>&1 <<<"$weekly_resp"; then
  echo "ERROR: weeks endpoint not JSON for $DATE/$MENU_TYPE" >&2
  echo "URL: $WEEKS_URL" >&2
  exit 1
fi

# Try all known shapes for id/name:
#  - .menu_items[].food.id / .food.name
#  - .menu_items[].menu_item.id / .menu_item.name
#  - .menu_items[].id / .name  (flat)
readarray -t ID_NAME <<<"$(
  jq -r --arg d "$DATE" '
    .days[] | select(.date==$d) | .menu_items[]? |
    (
      ( .food.id // .menu_item.id // .id ) as $id |
      ( .food.name // .menu_item.name // .name // "" ) as $name |
      select($id != null) |
      [$id, ($name|tostring)] | @tsv
    )
  ' <<<"$weekly_resp" \
  | awk 'NF' \
  | sort -u
)"

echo "Found ${#ID_NAME[@]} menu items for ${DATE} ${MENU_TYPE}" >&2
if ((${#ID_NAME[@]}==0)); then
  echo "No menu_items matched. Inspecting one sample node for keys…" >&2
  jq -r --arg d "$DATE" '
    .days[] | select(.date==$d) | .menu_items[0] // {}
  ' <<<"$weekly_resp" >&2 || true
fi

# Build an ID->name map
declare -A NAME_MAP
for row in "${ID_NAME[@]}"; do
  id="${row%%$'\t'*}"
  name="${row#*$'\t'}"
  NAME_MAP["$id"]="$name"
done

# ---------- 2) Emit CSV header ----------
echo "date,meal,id,name,calories,protein_g,source,serving_size"

# ---------- 3) For each ID, hit order-settings ----------
for id in "${!NAME_MAP[@]}"; do
  ITEM_URL="${BASE}/menu/api/menu-items/${id}/order-settings/?location-id=${LOCATION_ID}&menu-date=${DATE}"
  resp="$(curl_json "$ITEM_URL" || true)"

  if ! jq -e . >/dev/null 2>&1 <<<"$resp"; then
    printf '%s,%s,%s,"%s",,,no_json,\n' "$DATE" "$MENU_TYPE" "$id" "${NAME_MAP[$id]}"
    continue
  fi

  # prefer tax nutrition if present; fall back to raw
  echo "$resp" | jq -r --arg d "$DATE" --arg m "$MENU_TYPE" --arg id "$id" --arg name "${NAME_MAP[$id]}" '
    def csvsafe($s): if $s==null then "" else ($s|tostring|gsub("\""; "\"\"")) end;

    . as $root |
    ($root.tax_nutrition_info // {}) as $tax |
    ($root.raw_nutrition_info // {}) as $raw |
    ($tax|keys|length) as $hasTaxKeys |
    (if $hasTaxKeys>0 then $tax else $raw end) as $pick |

    {
      date: $d,
      meal: $m,
      id: $id,
      name: $name,
      calories: ($pick.calories),
      protein_g: ($pick.g_protein),
      source: (if $hasTaxKeys>0 then "tax" else "raw" end),
      serving_size: (
        ( ($root.portion_size|tostring)? // "" )
        + (if ($root.portion_size_unit? // "") != "" then " " + ($root.portion_size_unit|tostring) else "" end)
      )
    }
    | [
        .date, .meal, .id,
        csvsafe(.name),
        (.calories // empty),
        (.protein_g // empty),
        .source,
        csvsafe(.serving_size)
      ]
    | @csv
  '
done | sort -t, -k4,4
