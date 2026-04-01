import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

export type TrialExpiryEmailProps = {
  adminName: string;
  orgName: string;
  variant: "day10" | "day13" | "day14";
  plansCreated: number;
  stepsCompleted: number;
  appUrl: string;
};

const VARIANT_CONFIG = {
  day10: {
    subject: "Your trial ends in 4 days",
    preview: "Your Recaller trial ends in 4 days",
    heading: "Your trial ends in 4 days ⏰",
    message:
      "You still have time to explore everything Recaller has to offer. Upgrade now to keep your training plans and progress.",
    buttonText: "Upgrade Now",
    urgent: false,
  },
  day13: {
    subject: "Last day of your trial tomorrow",
    preview: "Your Recaller trial ends tomorrow",
    heading: "Your trial ends tomorrow ⚠️",
    message:
      "This is your last chance to upgrade before your trial expires. Don't lose your training data.",
    buttonText: "Upgrade Now",
    urgent: true,
  },
  day14: {
    subject: "Your trial has ended",
    preview: "Your Recaller trial has ended",
    heading: "Your trial has ended",
    message:
      "Your free trial is over. Upgrade to continue using Recaller and keep access to all your training plans and employee progress.",
    buttonText: "Reactivate Your Account",
    urgent: true,
  },
};

export default function TrialExpiryEmail({
  adminName,
  orgName,
  variant,
  plansCreated,
  stepsCompleted,
  appUrl,
}: TrialExpiryEmailProps) {
  const config = VARIANT_CONFIG[variant];
  const upgradeUrl = `${appUrl}/dashboard/settings`;

  return (
    <Html>
      <Head />
      <Preview>{config.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>{config.heading}</Text>
          <Text style={paragraph}>
            Hi {adminName}, your <strong>{orgName}</strong> trial on Recaller{" "}
            {variant === "day14" ? "has ended" : "is ending soon"}.
          </Text>
          <Text style={paragraph}>{config.message}</Text>

          <Section style={statsBox}>
            <Text style={statsTitle}>Your usage so far:</Text>
            <Text style={statLine}>
              📚 <strong>{plansCreated}</strong> training plan
              {plansCreated !== 1 ? "s" : ""} created
            </Text>
            <Text style={statLine}>
              ✅ <strong>{stepsCompleted}</strong> step
              {stepsCompleted !== 1 ? "s" : ""} completed by employees
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={{ textAlign: "center" as const, marginTop: 16 }}>
            <Button
              style={config.urgent ? buttonUrgent : button}
              href={upgradeUrl}
            >
              {config.buttonText}
            </Button>
          </Section>

          <Text style={footer}>
            Questions? Reply to this email or reach out to our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 32px",
  borderRadius: 8,
  maxWidth: 580,
};

const heading = {
  fontSize: 22,
  fontWeight: 700 as const,
  color: "#1a1a2e",
  marginBottom: 8,
};

const paragraph = {
  fontSize: 15,
  lineHeight: "24px",
  color: "#374151",
};

const statsBox = {
  backgroundColor: "#f0f9ff",
  border: "1px solid #bae6fd",
  borderRadius: 6,
  padding: "12px 16px",
  marginTop: 16,
};

const statsTitle = {
  fontSize: 14,
  fontWeight: 600 as const,
  color: "#0c4a6e",
  marginBottom: 8,
};

const statLine = {
  fontSize: 14,
  color: "#0369a1",
  margin: "4px 0",
};

const hr = { borderColor: "#e5e7eb", margin: "24px 0" };

const button = {
  backgroundColor: "#2563eb",
  borderRadius: 6,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600 as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
};

const buttonUrgent = {
  ...button,
  backgroundColor: "#dc2626",
};

const footer = {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 24,
  textAlign: "center" as const,
};
