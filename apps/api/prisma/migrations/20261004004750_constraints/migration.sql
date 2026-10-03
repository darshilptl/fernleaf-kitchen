-- Single-row settings
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_single CHECK (id = 1);
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_ranges CHECK (
  "cutoffTimeMinute" BETWEEN 0 AND 1439 AND "cutoffWorkingDays" >= 0 AND "atRiskMinutes" >= 0
  AND cardinality("kitchenWorkingDays") BETWEEN 1 AND 7 AND "kitchenWorkingDays" <@ ARRAY[1,2,3,4,5,6,7]);

-- One default tier; one active default address per company
CREATE UNIQUE INDEX one_default_tier ON price_tiers ("isDefault") WHERE "isDefault";
CREATE UNIQUE INDEX one_default_address ON company_addresses ("companyId") WHERE "isDefault" AND "isActive";

-- Case-insensitive uniqueness
CREATE UNIQUE INDEX allergens_name_ci ON allergens (lower(name));
CREATE UNIQUE INDEX dietary_tags_name_ci ON dietary_tags (lower(name));
CREATE UNIQUE INDEX kitchen_stations_name_ci ON kitchen_stations (lower(name));
CREATE UNIQUE INDEX portion_sizes_name_ci ON portion_sizes (lower(name));
CREATE UNIQUE INDEX packaging_types_name_ci ON packaging_types (lower(name));
CREATE UNIQUE INDEX price_tiers_name_ci ON price_tiers (lower(name));

-- Catalogue
ALTER TABLE dishes ADD CONSTRAINT dishes_ranges CHECK ("costCents" >= 0 AND ("minOrderQuantity" IS NULL OR "minOrderQuantity" >= 1));
ALTER TABLE options ADD CONSTRAINT options_cost CHECK ("costCents" >= 0);
ALTER TABLE option_group_portions ADD CONSTRAINT ogp_extra CHECK ("extraChargeCents" >= 0);

-- Pricing
ALTER TABLE dish_tier_prices ADD CONSTRAINT dtp_positive CHECK ("priceCents" > 0);
ALTER TABLE option_tier_prices ADD CONSTRAINT otp_nonneg CHECK ("priceCents" >= 0);
ALTER TABLE price_tiers ADD CONSTRAINT price_tiers_rule CHECK (
  ("derivationBasis" IS NULL AND "sourceTierId" IS NULL AND "multiplierBp" IS NULL)
  OR ("derivationBasis" = 'COST' AND "sourceTierId" IS NULL AND "multiplierBp" > 0)
  OR ("derivationBasis" = 'TIER' AND "sourceTierId" IS NOT NULL AND "sourceTierId" <> id AND "multiplierBp" > 0));

-- Companies
ALTER TABLE companies ADD CONSTRAINT companies_ranges CHECK (
  "defaultDeliveryMinute" BETWEEN 0 AND 1439 AND "dispatchLeadMinutes" BETWEEN 0 AND 720
  AND cardinality("workingDays") BETWEEN 1 AND 7 AND "workingDays" <@ ARRAY[1,2,3,4,5,6,7]);

-- Orders
ALTER TABLE orders ADD CONSTRAINT orders_ranges CHECK ("deliveryTimeMinute" BETWEEN 0 AND 1439 AND "totalCents" >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_chain CHECK (
  ("dispatchReadyAt" IS NULL OR "kitchenReadyAt" IS NOT NULL)
  AND ("outForDeliveryAt" IS NULL OR ("dispatchReadyAt" IS NOT NULL AND "driverId" IS NOT NULL))
  AND ("deliveredAt" IS NULL OR "outForDeliveryAt" IS NOT NULL));
ALTER TABLE order_lines ADD CONSTRAINT order_lines_ranges CHECK (quantity > 0 AND "dishPriceCents" >= 0 AND "lineTotalCents" >= 0);
ALTER TABLE order_line_combinations ADD CONSTRAINT olc_ranges CHECK (
  quantity > 0 AND "unitPriceCents" >= 0 AND "totalCents" >= 0 AND ("doneAt" IS NULL OR "startedAt" IS NOT NULL));
ALTER TABLE order_combination_choices ADD CONSTRAINT occ_ranges CHECK ("optionPriceCents" >= 0 AND "portionExtraCents" >= 0);

-- Billing
ALTER TABLE invoices ADD CONSTRAINT invoices_total CHECK ("totalCents" >= 0);