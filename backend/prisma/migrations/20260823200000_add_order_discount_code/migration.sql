-- Store only the canonical code accepted when the order is submitted.
ALTER TABLE "Order" ADD COLUMN "discountCode" TEXT;
