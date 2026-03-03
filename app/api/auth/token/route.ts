import { NextResponse } from "next/server";

// OAuth token exchange is no longer used. Auth is handled via POST /v2/auth/login.
export async function POST() {
  return NextResponse.json({ message: "Not used." }, { status: 410 });
}
