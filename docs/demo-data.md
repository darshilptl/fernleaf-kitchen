# Demo data part 1 (reference, catalogue, pricing, companies, menu)

Prices in dollars. All emails lowercase `first.last@<domain>`. Create-if-missing by natural key; never overwrite existing rows.

## Reference data

- Allergens: Gluten, Dairy, Nuts, Peanuts, Soy, Eggs, Sesame, Mustard
- Dietary tags: Vegan, Vegetarian, Jain, Gluten-free, Halal
- Stations: Bowls, Cold Kitchen, Breakfast, Desserts
- Portion sizes: Regular, Large (list only, portions not sold)
- Packaging types: Standard box, Eco compostable, Insulated bag

## Options (cost, Standard typed price)

| Option       | Cost | Standard |
| ------------ | ---- | -------- |
| Brown rice   | 0.40 | 0.00     |
| Jeera rice   | 0.50 | 0.50     |
| Raita        | 0.40 | 0.60     |
| Mint chutney | 0.20 | 0.30     |
| Paneer       | 1.20 | 1.50     |
| Tofu         | 1.00 | 1.20     |
| Chickpeas    | 0.80 | 1.00     |

## Dishes

| SKU     | Name                         | Temp | Cost | Station      | Allergens     | Tags                    | Groups                                                                                          |
| ------- | ---------------------------- | ---- | ---- | ------------ | ------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| BWL-101 | Paneer Rice Bowl (min qty 5) | HOT  | 3.10 | Bowls        | Dairy         | Vegetarian, Gluten-free | "Choose your rice" required: Brown rice, Jeera rice. "Add a side" optional: Raita, Mint chutney |
| BWL-102 | Chickpea Power Bowl          | HOT  | 2.60 | Bowls        | none          | Vegan, Gluten-free      | "Choose your rice" required: Brown rice, Jeera rice                                             |
| BWL-103 | Tofu Teriyaki Bowl           | HOT  | 3.00 | Bowls        | Soy           | Vegan                   | "Choose your rice" required: Brown rice, Jeera rice                                             |
| BRK-201 | Masala Omelette Wrap         | HOT  | 2.20 | Breakfast    | Eggs, Gluten  | none                    | none                                                                                            |
| BRK-202 | Overnight Oats Jar           | COLD | 1.90 | Breakfast    | Nuts, Gluten  | Vegetarian              | none                                                                                            |
| DST-301 | Gulab Jamun (2 pcs)          | HOT  | 1.40 | Desserts     | Dairy, Gluten | Vegetarian              | none                                                                                            |
| DST-302 | Mango Chia Pudding           | COLD | 1.60 | Desserts     | none          | Vegan, Gluten-free      | none                                                                                            |
| COL-401 | Quinoa Salad Box             | COLD | 2.80 | Cold Kitchen | none          | Vegan                   | none                                                                                            |
| SPC-501 | Chef's Thali                 | HOT  | 4.20 | Bowls        | Dairy, Soy    | Vegetarian              | "Choose your protein" required: Paneer, Tofu, Chickpeas                                         |

## Price tiers

- Standard (default, typed prices): BWL-101 7.00, BWL-102 6.50, BWL-103 6.90, BRK-201 5.50, **BRK-202 none (deliberately missing)**, DST-301 3.50, DST-302 4.00, COL-401 7.20, SPC-501 9.50. Options: typed prices from the options table.
- Enterprise: rule Standard price +15%, plus ONE typed override: BWL-102 = 7.25.
- Partner: rule cost x 2.4, no overrides.
  Expected derived values (cents rule: ceil to a multiple of 5): Enterprise BWL-101 8.05, BWL-103 7.95, BRK-201 6.35, DST-301 4.05, DST-302 4.60, SPC-501 10.95. Partner BWL-101 7.45, BWL-102 6.25, BWL-103 7.20,
  BRK-201 5.30, BRK-202 4.60, DST-301 3.40, DST-302 3.85, SPC-501 10.10.

## Companies (default driver driver@test.com for Acme Foods and Initech Labs)

| Company                                                                | Domain                   | Tier                | Working days | Delivery | Lead | Packaging       | Addresses               | Calendar                         | Menu hiding             |
| ---------------------------------------------------------------------- | ------------------------ | ------------------- | ------------ | -------- | ---- | --------------- | ----------------------- | -------------------------------- | ----------------------- |
| Acme Foods                                                             | acme-foods.example       | Enterprise          | Mon-Fri      | 12:30    | 60   | Standard box    | HQ (default), Warehouse | holiday: the Friday of next week | none                    |
| Globex Logistics                                                       | globex-logistics.example | none (default tier) | Mon-Sat      | 13:00    | 45   | Insulated bag   | Main (default)          | none                             | hides category Desserts |
| Initech Labs                                                           | initech-labs.example     | Partner             | Mon-Fri      | 12:00    | 60   | Eco compostable | HQ (default), Lab annex | none                             | hides item Gulab Jamun  |
| Hooli Studios                                                          | hooli-studios.example    | Enterprise          | Mon-Fri      | 12:15    | 60   | Standard box    | Studio (default)        | holiday: the Monday of next week | none                    |
| Stark Interiors (INACTIVE)                                             | stark-interiors.example  | none                | Mon-Fri      | 11:45    | 90   | Standard box    | Office (default)        | none                             | none                    |
| Addresses: invent plausible street, city, postal code, country values. |

## Employees (first listed = owner; flags default false)

- Acme Foods: Riya Shah (owner; canChangeDeliveryTime), Karan Mehta (canChooseAddress), Neha Iyer (allergy Peanuts), Aman Verma (diet Vegan; canChangePackaging), Priya Nair, Dev Patel
- Globex Logistics: Maya Rao (owner), Sam Dsouza, Tara Khan (allergy Dairy), Vikram Joshi
- Initech Labs: Ishaan Gupta (owner), Leena Pillai (diet Jain), Rohan Das, Zoya Ali
- Hooli Studios: Nina Kapoor (owner), Arjun Rao, Meera Sethi (INACTIVE employee)
- Stark Interiors: Omar Sheikh (owner), Pooja Menon

## Menu

| Category     | Order | State                    | Items (in order)                                        |
| ------------ | ----- | ------------------------ | ------------------------------------------------------- |
| Bowls        | 1     | active                   | BWL-101, BWL-102, BWL-103, COL-401 (placement INACTIVE) |
| Breakfast    | 2     | active                   | BRK-201, BRK-202                                        |
| Desserts     | 3     | active                   | DST-301, DST-302                                        |
| Chef's Table | 4     | secret, slug chefs-table | SPC-501, BWL-101 (second placement)                     |
| Seasonal     | 5     | inactive                 | DST-302 (second placement)                              |

## Expected previews (acceptance test)

- Riya Shah (Acme, Enterprise): Bowls 8.05 / 7.25 / 7.95; Breakfast: Omelette 6.35 only (Oats absent: no Standard price, so none on Enterprise); Desserts 4.05 / 4.60. Not listed: Chef's Table, Seasonal, Quinoa.
  By slug chefs-table: Thali 10.95 and Paneer Rice Bowl 8.05.
- Maya Rao (Globex, default Standard): Bowls 7.00 / 6.50 / 6.90; Breakfast: Omelette 5.50 only; no Desserts category (hidden).
- Ishaan Gupta (Initech, Partner): Bowls 7.45 / 6.25 / 7.20; Breakfast: Omelette 5.30 and Oats 4.60; Desserts: Mango Chia 3.85 only (Gulab Jamun hidden); chefs-table: Thali 10.10.
- Omar Sheikh (Stark, inactive company): the preview shows the inactive banner.
