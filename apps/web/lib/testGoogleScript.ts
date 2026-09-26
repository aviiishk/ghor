const TEST_GOOGLE_SCRIPT_TIMEOUT_MS = 10000;

export async function testGoogleScript() {
  const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!webhookUrl) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_GOOGLE_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "check",
        email: "test@example.com"
      }),
      signal: controller.signal
    });

    const text = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      redirected: response.redirected,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 500)
    };
  } finally {
    clearTimeout(timeout);
  }
}
