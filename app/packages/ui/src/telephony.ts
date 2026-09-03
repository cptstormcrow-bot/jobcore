// Promoted from app/modules/field-tech/src/screens/FieldJobDetail.tsx's
// local telUrl() helper so it can be shared via @jobcore/ui.
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
