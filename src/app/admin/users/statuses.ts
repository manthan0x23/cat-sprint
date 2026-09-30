// Shared by the server page (validates ?status=) and the client list, so it can't live in the "use client" file.
export const STATUSES = [
  { id: "all", label: "Everyone" },
  { id: "onboarded", label: "Onboarded" },
  { id: "not-onboarded", label: "Not onboarded" },
  { id: "active-today", label: "Active today" },
  { id: "active-7d", label: "Active in 7 days" },
  { id: "inactive", label: "Onboarded, inactive 7+ days" },
] as const;
export type Status = (typeof STATUSES)[number]["id"];
