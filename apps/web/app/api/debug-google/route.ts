import { NextResponse } from "next/server";
import { testGoogleScript } from "@/lib/testGoogleScript";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  try {
    const result = await testGoogleScript();

    return NextResponse.json(result, {
      status: 200
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown debug error."
      },
      {
        status: 500
      }
    );
  }
}
