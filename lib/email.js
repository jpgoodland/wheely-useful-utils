import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION || "us-west-2" });

const FROM_ADDRESS = `"Spin the Wheel" <no-reply@${process.env.APP_DOMAIN || "localhost"}>`;

/**
 * Send an email via AWS SES.
 *
 * In local development (DYNAMODB_ENDPOINT is set), the email content is
 * logged to stdout instead of actually sending. This keeps the dev loop
 * fast and free of AWS credentials.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
export async function sendEmail({ to, subject, text, html }) {
  // Local dev — just log it
  if (process.env.DYNAMODB_ENDPOINT) {
    console.log(
      `\n--- EMAIL (local dev) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-------------------------\n`
    );
    return;
  }

  const params = {
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: text, Charset: "UTF-8" },
        ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
      },
    },
    ConfigurationSetName: process.env.SES_CONFIG_SET || undefined,
  };

  await ses.send(new SendEmailCommand(params));
}
