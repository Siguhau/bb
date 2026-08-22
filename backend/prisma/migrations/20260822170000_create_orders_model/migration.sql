-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "bikeBrand" TEXT NOT NULL,
    "expectedDueDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_expectedDueDate_calendar_date" CHECK (
      length("expectedDueDate") = 10
      AND "expectedDueDate" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    )
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OrderService" (
    "orderId" TEXT NOT NULL,
    "serviceTypeCode" TEXT NOT NULL,

    PRIMARY KEY ("orderId", "serviceTypeCode"),
    CONSTRAINT "OrderService_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderService_serviceTypeCode_fkey" FOREIGN KEY ("serviceTypeCode") REFERENCES "ServiceType" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapacityReservation" (
    "orderId" TEXT NOT NULL PRIMARY KEY,
    "dueDate" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    CONSTRAINT "CapacityReservation_orderId_dueDate_fkey" FOREIGN KEY ("orderId", "dueDate") REFERENCES "Order" ("id", "expectedDueDate") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CapacityReservation_dueDate_calendar_date" CHECK (
      length("dueDate") = 10
      AND "dueDate" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    ),
    CONSTRAINT "CapacityReservation_slot_range" CHECK ("slot" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE INDEX "Order_emailAddress_idx" ON "Order"("emailAddress");

-- CreateIndex
CREATE INDEX "Order_phoneNumber_idx" ON "Order"("phoneNumber");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_expectedDueDate_idx" ON "Order"("expectedDueDate");

-- The composite key keeps each reservation on its order's expected due date.
CREATE UNIQUE INDEX "Order_id_expectedDueDate_key" ON "Order"("id", "expectedDueDate");

-- CreateIndex
CREATE INDEX "OrderService_serviceTypeCode_idx" ON "OrderService"("serviceTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityReservation_orderId_dueDate_key" ON "CapacityReservation"("orderId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityReservation_dueDate_slot_key" ON "CapacityReservation"("dueDate", "slot");

-- Seed the fixed set of supported service types.
INSERT INTO "ServiceType" ("code", "displayName") VALUES
  ('WHEEL_ADJUSTMENT', 'Wheel adjustment'),
  ('CHAIN_REPLACEMENT', 'Chain replacement'),
  ('BRAKE_MAINTENANCE', 'Brake maintenance');
