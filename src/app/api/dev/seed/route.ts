import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { seedDemo } from "@/lib/dev-seed";

// Dev-only: fills the signed-in account with 3 weeks of fake history + 3 demo friends.
export async function POST() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  return NextResponse.json(await seedDemo(session.user.email));
}
