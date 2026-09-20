import { signOut } from "@/auth";

// Clears a session cookie that points at a user row which no longer exists (for example after
// the database was replaced) and sends the person back to sign in, where a fresh row is made.
export async function GET() {
  await signOut({ redirectTo: "/" });
}
