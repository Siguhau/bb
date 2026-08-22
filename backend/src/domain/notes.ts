export function parseOptionalNotes(
  value: unknown,
  errors: Record<string, string>,
): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== "string") {
    errors.notes = "Notes must be text.";
    return null;
  }

  const notes = value.trim();
  if (notes.length > 2_000) {
    errors.notes = "Notes must be 2000 characters or fewer.";
  }

  return notes || null;
}
