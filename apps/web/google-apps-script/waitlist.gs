const SHEET_NAME = "Waitlist";

// Deployment check:
// Apps Script Web App URLs keep serving the selected deployment version.
// After editing this file in Apps Script, use Deploy > Manage deployments > Edit
// and create a new version, then confirm GOOGLE_APPS_SCRIPT_URL points to that
// active /exec URL. If rows are not written, confirm SPREADSHEET_ID is the real
// Google Sheet ID and the deployed script account has access to that sheet.

function doPost(event) {
  try {
    const rawBody = event && event.postData ? event.postData.contents || "{}" : "{}";

    const body = JSON.parse(rawBody);

    const action = String(body.action || "").toLowerCase();
    const sheet = getWaitlistSheet_();

    if (action === "check") {
      const email = normalizeEmail_(body.email);
      const exists = emailExists_(sheet, email);
      Logger.log("Check action complete. exists=" + exists);

      return json_({
        success: true,
        exists: exists
      });
    }

    if (action === "add") {
      const name = String(body.name || "").trim();
      const email = normalizeEmail_(body.email);
      const phone = String(body.phone || "").trim();

      if (!name || !email || !phone) {
        Logger.log("Add action rejected. Missing required field.");
        return json_({
          success: false,
          message: "Name, email, and phone are required."
        });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        if (emailExists_(sheet, email)) {
          Logger.log("Duplicate detected.");
          return json_({
            success: true,
            exists: true,
            message: "Email already exists."
          });
        }

        const row = [new Date(), name, email, phone];
        sheet.appendRow(row);
        Logger.log("Row appended.");

        return json_({
          success: true,
          exists: false,
          message: "Lead added."
        });
      } finally {
        lock.releaseLock();
      }
    }

    Logger.log("Unsupported action: " + action);
    return json_({
      success: false,
      message: "Unsupported action."
    });
  } catch (error) {
    Logger.log("doPost error: " + (error.stack || error.message || error));
    return json_({
      success: false,
      message: error.message || "Apps Script error."
    });
  }
}

function testSheetWrite() {
  const sheet = getWaitlistSheet_();
  const row = [new Date(), "Test User", "test@example.com", "9999999999"];
  sheet.appendRow(row);
  Logger.log("testSheetWrite row appended: " + JSON.stringify(row));

  return json_({
    success: true,
    message: "Test row appended.",
    row: row
  });
}

function getWaitlistSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID script property is not configured.");
  }

  Logger.log("Opening waitlist spreadsheet.");
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  Logger.log("Spreadsheet opened: " + spreadsheet.getName());

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (sheet) {
    Logger.log("Sheet found: " + SHEET_NAME);
  } else {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    Logger.log("Sheet created: " + SHEET_NAME);
  }

  ensureHeaders_(sheet);

  return sheet;
}

function ensureHeaders_(sheet) {
  const headers = ["Timestamp", "Name", "Email", "Phone"];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    Logger.log("Headers created on empty sheet: " + JSON.stringify(headers));
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every(function (header, index) {
    return String(currentHeaders[index] || "").trim() === header;
  });

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    Logger.log("Headers repaired: " + JSON.stringify(headers));
  } else {
    Logger.log("Headers already present.");
  }
}

function emailExists_(sheet, email) {
  if (!email || sheet.getLastRow() < 2) {
    Logger.log("Duplicate check skipped. rows=" + sheet.getLastRow());
    return false;
  }

  const values = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  const exists = values.some(function (row) {
    return normalizeEmail_(row[0]) === email;
  });

  Logger.log("Duplicate check complete. exists=" + exists);
  return exists;
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function json_(payload) {
  Logger.log("JSON response: " + JSON.stringify(payload));
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
