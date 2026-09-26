import { NextResponse } from "next/server";
import { sendWaitlistWelcomeEmail } from "@/lib/email";
import { addWaitlistLead, checkWaitlistEmailExists } from "@/lib/googleSheets";
import type { WaitlistLead } from "@/types/waitlist";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateWaitlistLead(body: unknown): {
  lead?: WaitlistLead;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");

  if (name.length < 2) {
    return { error: "Name must be at least 2 characters." };
  }

  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (phoneDigits.length < 10) {
    return { error: "Phone number must contain at least 10 digits." };
  }

  return {
    lead: {
      name,
      email,
      phone
    }
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    const rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch (parseError) {
    console.error("[/api/waitlist JSON parse failed]", parseError);
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { lead, error } = validateWaitlistLead(body);

  if (!lead) {
    return NextResponse.json(
      { success: false, message: error || "Invalid waitlist data." },
      { status: 400 }
    );
  }

  try {
    const exists = await checkWaitlistEmailExists(lead.email);

    if (exists) {
      return NextResponse.json(
        { success: false, message: "You're already on the waitlist." },
        { status: 409 }
      );
    }

    const addResult = await addWaitlistLead(lead);

    if (addResult.duplicate) {
      return NextResponse.json(
        { success: false, message: "You're already on the waitlist." },
        { status: 409 }
      );
    }

    try {
      await sendWaitlistWelcomeEmail(lead);
    } catch (emailError) {
      console.error("[/api/waitlist welcome email failed]", emailError);
    }

    const result = { success: true, message: "Spot reserved successfully." };

    return NextResponse.json(
      result,
      { status: 201 }
    );
  } catch (submissionError) {
    console.error("[/api/waitlist submission failed]", submissionError);

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 502 }
    );
  }
}
