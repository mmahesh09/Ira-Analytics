import { toNextJsHandler } from "better-auth/next-js";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { after, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { posthogLog, posthogLogProvider } from "../../../../../instrumentation";

const authHandlers = toNextJsHandler(auth);

function flushPostHogLogs() {
  after(async () => {
    await posthogLogProvider?.forceFlush();
  });
}

async function handleAuthRequest(method: "GET" | "POST", request: NextRequest) {
  posthogLog?.emit({
    body: "Authentication request received",
    severityNumber: SeverityNumber.INFO,
    attributes: { "http.request.method": method, "http.route": "/api/auth/[...all]" },
  });

  try {
    const response = await authHandlers[method](request);
    posthogLog?.emit({
      body: "Authentication request completed",
      severityNumber: SeverityNumber.INFO,
      attributes: {
        "http.request.method": method,
        "http.response.status_code": response.status,
        "http.route": "/api/auth/[...all]",
      },
    });
    flushPostHogLogs();
    return response;
  } catch (error) {
    posthogLog?.emit({
      body: "Authentication request failed",
      severityNumber: SeverityNumber.ERROR,
      attributes: { "http.request.method": method, "http.route": "/api/auth/[...all]" },
    });
    flushPostHogLogs();
    throw error;
  }
}

export async function GET(request: NextRequest) {
  return handleAuthRequest("GET", request);
}

export async function POST(request: NextRequest) {
  return handleAuthRequest("POST", request);
}
