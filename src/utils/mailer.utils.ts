import { BrevoClient, logging } from "@getbrevo/brevo";

// 1. Initialize Brevo Client with automatic exponential backoff retries & logging
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY || "",
  maxRetries: 3, // Automatically retries 408, 429, 500, 502, 503, 504 with exponential backoff & jitter
  timeoutInSeconds: 30,
  logging: {
    level:
      process.env.NODE_ENV === "production"
        ? logging.LogLevel.Info
        : logging.LogLevel.Debug,
    logger: new logging.ConsoleLogger(),
  },
});

interface SendMailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
}

/**
 * Sends a transactional email using the latest @getbrevo/brevo SDK (v6+).
 * Handles SDK-level errors, exponential backoff, rate limits, and logging.
 */
export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  senderName,
  senderEmail,
}: SendMailOptions): Promise<void> => {
  const sender = {
    name: senderName || process.env.SENDER_NAME || "Synapse",
    email: senderEmail || process.env.SENDER_EMAIL || "noreply@zephy.co.in",
  };

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent,
      sender,
      to: [{ email: to }],
    });

    console.log(
      `[Mailer] Email sent successfully to ${to}. MessageId: ${result.messageId}`,
    );
  } catch (error: any) {
    // Extract common properties exposed on standard Brevo SDK errors
    const statusCode = error?.statusCode || error?.status;
    const message = error?.message || "Unknown mailer error";

    if (statusCode === 401) {
      console.error(
        "[Mailer Error] Unauthorized (401): Invalid or missing Brevo API key.",
      );
      throw new Error("Email service authentication failed.");
    }

    if (statusCode === 429) {
      const retryAfter =
        error?.rawResponse?.headers?.get?.("retry-after") || "unknown";
      console.error(
        `[Mailer Error] Rate limit exceeded (429). Retry-After: ${retryAfter} seconds.`,
      );
      throw new Error(
        "Email service is temporarily busy. Please try again later.",
      );
    }

    // General Brevo API / HTTP Error fallback
    if (statusCode) {
      console.error(
        `[Mailer Error] API Error [Status ${statusCode}]: ${message}`,
        {
          body: error?.body,
        },
      );
      throw new Error(`Failed to send email: ${message}`);
    }

    // Network/System error fallback
    console.error(
      "[Mailer Error] Unexpected error while sending email:",
      error,
    );
    throw new Error("An unexpected error occurred while sending the email.");
  }
};
