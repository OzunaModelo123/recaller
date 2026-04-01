import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
  Preview,
} from "@react-email/components";

export type AssignmentEmailProps = {
  employeeName: string;
  planTitle: string;
  steps: {
    stepNumber: number;
    title: string;
    instructions: string;
    proofInstructions: string;
  }[];
  dueDate: string | null;
  assignerNote: string | null;
  appUrl: string;
  assignmentId: string;
};

export default function AssignmentEmail({
  employeeName,
  planTitle,
  steps,
  dueDate,
  assignerNote,
  appUrl,
  assignmentId,
}: AssignmentEmailProps) {
  const viewUrl = `${appUrl}/employee/my-plans/${assignmentId}`;

  return (
    <Html>
      <Head />
      <Preview>New training plan: {planTitle}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img
            src={`${appUrl}/vercel.svg`}
            width={40}
            height={40}
            alt="Recaller"
            style={{ marginBottom: 16 }}
          />
          <Text style={heading}>New Training Plan Assigned</Text>
          <Text style={paragraph}>
            Hi {employeeName}, you&apos;ve been assigned a new training plan:
          </Text>
          <Text style={planTitleStyle}>{planTitle}</Text>

          {assignerNote && (
            <Section style={noteBox}>
              <Text style={noteLabel}>Note from your manager:</Text>
              <Text style={noteText}>{assignerNote}</Text>
            </Section>
          )}

          {dueDate && (
            <Text style={paragraph}>
              <strong>Due:</strong>{" "}
              {new Date(dueDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          )}

          <Hr style={hr} />

          <Text style={sectionTitle}>
            Your Steps ({steps.length} total)
          </Text>

          {steps.map((step) => (
            <Section key={step.stepNumber} style={stepBox}>
              <Text style={stepTitle}>
                Step {step.stepNumber}: {step.title}
              </Text>
              <Text style={stepInstructions}>{step.instructions}</Text>
              {step.proofInstructions && (
                <Text style={proofText}>
                  📋 Proof required: {step.proofInstructions}
                </Text>
              )}
            </Section>
          ))}

          <Hr style={hr} />

          <Section style={{ textAlign: "center" as const, marginTop: 24 }}>
            <Button style={button} href={viewUrl}>
              View in Recaller
            </Button>
          </Section>

          <Text style={footer}>
            This email was sent by Recaller. If you believe you received it in
            error, contact your manager.
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

const planTitleStyle = {
  fontSize: 18,
  fontWeight: 600 as const,
  color: "#2563eb",
  margin: "8px 0 16px",
};

const noteBox = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 6,
  padding: "12px 16px",
  marginBottom: 16,
};

const noteLabel = {
  fontSize: 12,
  fontWeight: 600 as const,
  color: "#6b7280",
  marginBottom: 4,
};

const noteText = {
  fontSize: 14,
  color: "#374151",
  margin: 0,
};

const hr = { borderColor: "#e5e7eb", margin: "24px 0" };

const sectionTitle = {
  fontSize: 16,
  fontWeight: 600 as const,
  color: "#1a1a2e",
  marginBottom: 12,
};

const stepBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "12px 16px",
  marginBottom: 12,
};

const stepTitle = {
  fontSize: 14,
  fontWeight: 600 as const,
  color: "#1a1a2e",
  marginBottom: 4,
};

const stepInstructions = {
  fontSize: 13,
  lineHeight: "20px",
  color: "#4b5563",
  marginBottom: 4,
};

const proofText = {
  fontSize: 12,
  color: "#6b7280",
  fontStyle: "italic" as const,
  margin: 0,
};

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

const footer = {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 32,
  textAlign: "center" as const,
};
