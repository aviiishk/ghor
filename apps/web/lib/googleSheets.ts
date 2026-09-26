import type { WaitlistLead } from "@/types/waitlist";

type GoogleScriptResponse = {
  success?: boolean;
  exists?: boolean;
  message?: string;
};

const GOOGLE_SCRIPT_TIMEOUT_MS = 10000;
const BODY_PREVIEW_LENGTH = 1200;

function previewBody(text: string) {
  return text.length > BODY_PREVIEW_LENGTH
    ? `${text.slice(0, BODY_PREVIEW_LENGTH)}...`
    : text;
}

function looksLikeGoogleHtml(text: string) {
  const normalized = text.trim().toLowerCase();

  return (
    normalized.startsWith("<!doctype html") ||
    normalized.startsWith("<html") ||
    normalized.includes("accounts.google.com") ||
    normalized.includes("script.google.com") ||
    normalized.includes("googleusercontent.com") ||
    normalized.includes("sorry, unable to open the file") ||
    normalized.includes("authorization is required") ||
    normalized.includes("you need access")
  );
}

function looksLikeJson(text: string) {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function logAppsScriptResponse({
  response,
  text
}: {
  response: Response;
  text: string;
}) {
  if (response.ok && !looksLikeGoogleHtml(text)) {
    return;
  }

  const details = {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    redirected: response.redirected,
    contentType: response.headers.get("content-type")
  };

  if (looksLikeGoogleHtml(text)) {
    console.error("[Google Apps Script redirect/html detected]", details);
    return;
  }

  console.error("[Google Apps Script unexpected response]", details);
}

async function postToGoogleScript(payload: Record<string, unknown>) {
  const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!webhookUrl) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    logAppsScriptResponse({ response, text });

    let data: GoogleScriptResponse = {};

    if (text) {
      if (!contentType.toLowerCase().includes("application/json") && !looksLikeJson(text)) {
        throw new Error(
          [
            "Invalid JSON from Apps Script:",
            `status=${response.status}`,
            `url=${response.url}`,
            `redirected=${response.redirected}`,
            `content-type=${contentType || "missing"}`,
            previewBody(text)
          ].join("\n")
        );
      }

      try {
        data = JSON.parse(text) as GoogleScriptResponse;
      } catch {
        throw new Error(
          [
            "Invalid JSON from Apps Script:",
            `status=${response.status}`,
            `url=${response.url}`,
            `redirected=${response.redirected}`,
            `content-type=${contentType || "missing"}`,
            previewBody(text)
          ].join("\n")
        );
      }
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Google Apps Script request failed.");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Google Apps Script request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkWaitlistEmailExists(email: string) {
  const data = await postToGoogleScript({
    action: "check",
    email
  });

  return Boolean(data.exists);
}

export async function addWaitlistLead(lead: WaitlistLead) {
  const data = await postToGoogleScript({
    action: "add",
    ...lead
  });

  if (data.exists) {
    return { duplicate: true };
  }

  return { duplicate: false };
}
