import json
import re
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
HOTEL_DATA = ROOT / "assets" / "hotelData.js"


def clean(value):
    text = "" if pd.isna(value) else str(value)
    return re.sub(r"\s+", " ", text).strip()


def unique(values):
    result = []
    seen = set()
    for value in values:
        value = clean(value)
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def current_data():
    source = HOTEL_DATA.read_text(encoding="utf-8")
    match = re.search(r"const rows = `(.+?)`;", source, re.S)
    if match:
        data = {}
        for line in match.group(1).splitlines():
            if not line.strip():
                continue
            hotel, *rooms = line.split("\t")
            hotel = clean(hotel)
            data[hotel] = {"rooms": rooms, "meals": []}
        return data

    data_match = re.search(r"window\.HotelCalculatorHotelData\s*=\s*(\{.+?\});", source, re.S)
    if not data_match:
        raise RuntimeError("Cannot read current hotel data format")
    raw_data = json.loads(data_match.group(1))
    data = {}
    for raw_hotel, record in raw_data.items():
        hotel = clean(raw_hotel).lstrip("`")
        if isinstance(record, list):
            data[hotel] = {"rooms": record, "meals": []}
        else:
            data[hotel] = {
                "rooms": record.get("rooms", []),
                "meals": record.get("meals", []),
            }
    return data


def load_rooms(path, hotel_names):
    df = pd.read_excel(path, sheet_name="Room Categories")
    df["Hotel"] = df["Hotel"].map(clean)
    df["Room Category"] = df["Room Category"].map(clean)
    grouped = {}
    for hotel, rows in df[df["Hotel"].isin(hotel_names)].groupby("Hotel", sort=False):
        grouped[hotel] = unique(rows["Room Category"])
    return grouped


def load_meals(path, hotel_names):
    df = pd.read_excel(path, sheet_name="Meal Plans")
    df["Hotel"] = df["Hotel"].map(clean)
    df["Normalized Code"] = df["Normalized Code"].map(clean)
    df["Meal Plan"] = df["Meal Plan"].map(clean)
    grouped = {}
    for hotel, rows in df[df["Hotel"].isin(hotel_names)].groupby("Hotel", sort=False):
        bases = unique(rows["Meal Plan"].where(rows["Meal Plan"] != "", rows["Normalized Code"]))
        meals = []
        for base in bases:
            meals.extend([f"{base} - Adult", f"{base} - Child"])
        grouped[hotel] = meals
    return grouped


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: import_reference_data.py <room-categories.xlsx> <meal-plans.xlsx>")

    current = current_data()
    hotel_names = list(current.keys())
    hotel_set = set(hotel_names)
    rooms = load_rooms(Path(sys.argv[1]), hotel_set)
    meals = load_meals(Path(sys.argv[2]), hotel_set)

    data = {}
    for hotel in hotel_names:
        data[hotel] = {
            "rooms": rooms.get(hotel, current[hotel]["rooms"]),
            "meals": meals.get(hotel, []),
        }

    output = "(function () {\n"
    output += "  window.HotelCalculatorHotelData = "
    output += json.dumps(data, ensure_ascii=False, indent=2)
    output += ";\n})();\n"
    HOTEL_DATA.write_text(output, encoding="utf-8")

    skipped_room_hotels = sorted(set(pd.read_excel(sys.argv[1], sheet_name="Room Categories")["Hotel"].map(clean)) - hotel_set)
    skipped_meal_hotels = sorted(set(pd.read_excel(sys.argv[2], sheet_name="Meal Plans")["Hotel"].map(clean)) - hotel_set)
    print(f"Hotels kept: {len(hotel_names)}")
    print(f"Hotels with imported rooms: {sum(1 for hotel in hotel_names if data[hotel]['rooms'])}")
    print(f"Hotels with imported meals: {sum(1 for hotel in hotel_names if data[hotel]['meals'])}")
    print(f"Skipped room hotels: {len(skipped_room_hotels)}")
    print(f"Skipped meal hotels: {len(skipped_meal_hotels)}")
    if skipped_room_hotels:
        print("Skipped room hotel names:", ", ".join(skipped_room_hotels))
    if skipped_meal_hotels:
        print("Skipped meal hotel names:", ", ".join(skipped_meal_hotels))


if __name__ == "__main__":
    main()
