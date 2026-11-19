-- Car types become an editable list: store the readable name instead of a fixed enum
ALTER TABLE "vehicles" ALTER COLUMN "type" TYPE TEXT USING (
  CASE "type"::text
    WHEN 'HATCHBACK' THEN 'Hatchback'
    WHEN 'SEDAN' THEN 'Sedan'
    WHEN 'SUV' THEN 'SUV'
    WHEN 'MUV' THEN 'MUV'
    WHEN 'ELECTRIC' THEN 'Electric'
    WHEN 'LUXURY' THEN 'Luxury'
    ELSE "type"::text
  END
);

DROP TYPE "VehicleType";
