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

export type NudgeEmailProps = {
  employeeName: string;
  planTitle: string;
  stepNumber: number;
  stepTitle: string;
  stepInstructions: string;
  proofInstructions: string;
  appUrl: string;
  assignmentId: string;
};

export default function NudgeEmail({
  employeeName,
  planTitle,
  stepNumber,
  stepTitle,
  stepInstructions,
  proofInstructions,
  appUrl,
  assignmentId,
}: NudgeEmailProps) {
  const viewUrl = `${appUrl}/employee/my-plans/${assignmentId}`;

  return (
    <Html>
      <Head />
      <Preview>{`Reminder: Step ${stepNumber} of ${planTitle}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Friendly Reminder 👋</Text>
          <Text style={paragraph}>
            Hi {employeeName}, you haven&apos;t started{" "}
            <strong>
              Step {stepNumber}: {stepTitle}
            </strong>{" "}
            of <strong>{planTitle}</strong> yet.
          </Text>

          <Section style={stepBox}>
            <Text style={stepTitleStyle}>
              Step {stepNumber}: {stepTitle}
            </Text>
            <Text style={instructions}>{stepInstructions}</Text>
            {proofInstructions && (
              <Text style={proofText}>
                📋 Proof required: {proofInstructions}
              </Text>
            )}
          </Section>

          <Hr style={hr} />

          <Section style={{ textAlign: "center" as const, marginTop: 16 }}>
            <Button style={button} href={viewUrl}>
              Complete This Step
            </Button>
          </Section>

          <Text style={footer}>
            You&apos;re receiving this because you have an active training
            assignment. If you&apos;ve already completed this step, you can
            ignore this email.
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
  fontSize: 20,
  fontWeight: 700 as const,
  color: "#1a1a2e",
  marginBottom: 8,
};

const paragraph = {
  fontSize: 15,
  lineHeight: "24px",
  color: "#374151",
};

const stepBox = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: 6,
  padding: "12px 16px",
  marginTop: 16,
};

const stepTitleStyle = {
  fontSize: 14,
  fontWeight: 600 as const,
  color: "#92400e",
  marginBottom: 4,
};

const instructions = {
  fontSize: 13,
  lineHeight: "20px",
  color: "#78350f",
  marginBottom: 4,
};

const proofText = {
  fontSize: 12,
  color: "#92400e",
  fontStyle: "italic" as const,
  margin: 0,
};

const hr = { borderColor: "#e5e7eb", margin: "24px 0" };

const button = {
  backgroundColor: "#f59e0b",
  borderRadius: 6,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600 as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
};

const footer = {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 24,
  textAlign: "center" as const,
};
