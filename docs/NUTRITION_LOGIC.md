# Nutrition Logic

## BMR — Mifflin-St Jeor

```
Male:   BMR = 88.362 + (13.397 × kg) + (4.799 × cm) − (5.677 × age)
Female: BMR = 447.593 + (9.247 × kg) + (3.098 × cm) − (4.33 × age)
```

## TDEE

```
TDEE = BMR × activity multiplier
```

| Activity Level | Multiplier |
|---|---|
| Sedentary (desk job) | 1.2 |
| Light (1–3x/week) | 1.375 |
| Moderate (3–5x/week) | 1.55 |
| Active (6–7x/week) | 1.725 |
| Very Active (2x/day) | 1.9 |

## Goal Calorie Offsets

| Goal | Offset |
|---|---|
| Bulk | +400 kcal |
| Cut | −400 kcal |
| Lean Bulk | +150 kcal |
| Fat Loss | −400 kcal |

## Macro Targets — `computeTargets()`

Protein is set first from body weight. Remaining calories are then split between carbs and fat. This ensures the macro calories always sum to the calorie target.

```
calories   = TDEE + goal.calOffset
protein    = bodyweightLbs × goal.proteinPerLb          (grams)
remaining  = max(calories − protein × 4, 0)             (calories remaining after protein)
totalRatio = goal.carbPct + goal.fatPct
carbs      = (remaining × carbPct / totalRatio) / 4     (grams)
fat        = (remaining × fatPct  / totalRatio) / 9     (grams)
```

### Goal Parameters

| Goal | Protein/lb | Carb % of remainder | Fat % of remainder |
|---|---|---|---|
| Bulk | 0.9 g | 45% | 25% |
| Cut | 1.1 g | 32% | 25% |
| Lean Bulk | 1.0 g | 45% | 30% |
| Fat Loss | 0.9 g | 35% | 30% |

The carb/fat percentages split the **remaining** calories (after protein), not total calories. The ratio is normalized so carb% + fat% always = 100% of the remainder.

## Unit Conversions

| From | To grams | Notes |
|---|---|---|
| grams | × 1 | exact |
| oz | × 28.3495 | exact |
| ml | × 1 | approximation (assumes water density) |
| fl oz | × 29.5735 | approximation (assumes water density) |
| serving | × servingGrams | only when Open Food Facts provides a gram-based serving weight |

**Liquid density caveat:** `ml` and `fl oz` conversions assume water density (1 g/ml). This is wrong for most foods (e.g. olive oil ≈ 0.91 g/ml, honey ≈ 1.4 g/ml). The UI currently does not warn about this approximation.

## Food Data Source

All macro values come from [Open Food Facts](https://world.openfoodfacts.org) and are normalized to per-100g. Only `_100g` nutriment fields are used — per-serving fields from the API are inconsistent across products and not used for calculations.

Serving size (`srv` unit) is only offered when the product's `serving_quantity` field has a gram-based unit (`'g'` or unspecified). In that case, `servingGrams` is stored and used: `grams = servingCount × servingGrams`.
