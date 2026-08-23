import type { AdminOrder, AdminOrderPatch } from "../types/admin";

type EditableOrder = Pick<
  AdminOrder,
  "notes" | "status" | "expectedDueDate" | "serviceTypes"
>;

type EditedValues = {
  notes: string;
  status: AdminOrder["status"];
  expectedDueDate: string;
  serviceTypes: string[];
};

function sameCodes(left: string[], right: string[]) {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

export function createAdminOrderPatch(
  order: EditableOrder,
  edited: EditedValues,
): AdminOrderPatch {
  const patch: AdminOrderPatch = {};
  const notes = edited.notes.trim() || null;

  if (notes !== order.notes) patch.notes = notes;
  if (edited.status !== order.status) patch.status = edited.status;
  if (edited.expectedDueDate !== order.expectedDueDate)
    patch.expectedDueDate = edited.expectedDueDate;
  if (
    !sameCodes(
      order.serviceTypes.map((service) => service.code),
      edited.serviceTypes,
    )
  )
    patch.serviceTypes = edited.serviceTypes;

  return patch;
}
