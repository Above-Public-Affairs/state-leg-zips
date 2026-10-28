import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { reportError } from "@above-public-affairs/error-reporter";

export async function POST(request: Request) {
  try {
    const { state, stateCode } = await request.json();

    if (!state || !stateCode) {
      return NextResponse.json(
        { error: "State is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const toEmail = process.env.UPDATE_REQUEST_EMAIL;

    if (!apiKey || !fromEmail || !toEmail) {
      console.error("Missing email configuration environment variables");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    sgMail.setApiKey(apiKey);

    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      dateStyle: "full",
      timeStyle: "short",
    });

    await sgMail.send({
      to: toEmail,
      from: fromEmail,
      subject: `State Leg ZIPs: Update requested for ${state} (${stateCode})`,
      html: `
        <h2>Data Update Request</h2>
        <p><strong>State:</strong> ${state} (${stateCode})</p>
        <p><strong>Requested at:</strong> ${timestamp}</p>
        <hr>
        <p style="color: #999; font-size: 12px;">Sent from statelegzips.com</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: unknown }; message?: string };
    console.error("Failed to send update request email:", JSON.stringify(sgError.response?.body ?? sgError.message ?? error));

    reportError({
      project: "state-leg-zips",
      category: "email_error",
      message: sgError.message ?? "Failed to send update request email",
      rawError: error,
    });

    return NextResponse.json(
      { error: "Failed to send request", detail: sgError.response?.body ?? sgError.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
