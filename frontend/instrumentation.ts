import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

function missingPostHogConfiguration(variable: "NEXT_PUBLIC_POSTHOG_KEY" | "NEXT_PUBLIC_POSTHOG_HOST") {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
    );
  }
}

if (!posthogKey) {
  missingPostHogConfiguration("NEXT_PUBLIC_POSTHOG_KEY");
} else if (!posthogHost) {
  missingPostHogConfiguration("NEXT_PUBLIC_POSTHOG_HOST");
}

export const posthogLogProvider =
  posthogKey && posthogHost
    ? new LoggerProvider({
        resource: resourceFromAttributes({ "service.name": "rankwise-frontend" }),
        processors: [
          new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: `${posthogHost.replace(/\/$/, "")}/i/v1/logs`,
              headers: {
                Authorization: `Bearer ${posthogKey}`,
                "Content-Type": "application/json",
              },
            }),
          }),
        ],
      })
    : undefined;

export const posthogLog = posthogLogProvider?.getLogger("rankwise.posthog-integration");
