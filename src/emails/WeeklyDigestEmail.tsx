import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from "@react-email/components";

export type WeeklyDigestEmailProps = {
  adminName: string;
  orgName: string;
  totalAssignments: number;
  completedThisWeek: number;
  activeEmployees: number;
  topCompletions: { name: string; count: number }[];
  appUrl: string;
};

export default function WeeklyDigestEmail({
  adminName,
  orgName,
  totalAssignments,
  completedThisWeek,
  activeEmployees,
  topCompletions,
  appUrl,
}: WeeklyDigestEmailProps) {
  const completionRate =
    totalAssignments > 0
      ? Math.round((completedThisWeek / totalAssignments) * 100)
      : 0;

  return (
    <Html>
      <Head />
      <Preview>{`${orgName} weekly training digest — ${completedThisWeek} steps completed`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Weekly Training Digest</Text>
          <Text style={paragraph}>
            Hi {adminName}, here&apos;s your weekly summary for{" "}
            <strong>{orgName}</strong>.
          </Text>

          <Section style={statsGrid}>
            <Section style={statCard}>
              <Text style={statNumber}>{totalAssignments}</Text>
              <Text style={statLabel}>Active Assignments</Text>
            </Section>
            <Section style={statCard}>
              <Text style={statNumber}>{completedThisWeek}</Text>
              <Text style={statLabel}>Steps Completed</Text>
            </Section>
            <Section style={statCard}>
              <Text style={statNumber}>{activeEmployees}</Text>
              <Text style={statLabel}>Active Employees</Text>
            </Section>
            <Section style={statCard}>
              <Text style={statNumber}>{completionRate}%</Text>
              <Text style={statLabel}>Completion Rate</Text>
            </Section>
          </Section>

          {topCompletions.length > 0 && (
            <>
              <Hr style={hr} />
              <Text style={sectionTitle}>Top Performers</Text>
              {topCompletions.map((performer, i) => (
                <Text key={i} style={performerRow}>
                  🏆 {performer.name} — {performer.count} step
                  {performer.count !== 1 ? "s" : ""} completed
                </Text>
              ))}
            </>
          )}

          <Hr style={hr} />

          <Text style={ctaText}>
            View the full dashboard at{" "}
            <a href={`${appUrl}/dashboard`} style={link}>
              {appUrl}/dashboard
            </a>
          </Text>

          <Text style={footer}>
            Sent by Recaller every Monday. Manage notification preferences in
            your dashboard settings.
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

const statsGrid = {
  marginTop: 16,
};

const statCard = {
  display: "inline-block" as const,
  width: "48%",
  textAlign: "center" as const,
  padding: "12px 0",
};

const statNumber = {
  fontSize: 28,
  fontWeight: 700 as const,
  color: "#2563eb",
  margin: 0,
};

const statLabel = {
  fontSize: 12,
  color: "#6b7280",
  margin: 0,
};

const hr = { borderColor: "#e5e7eb", margin: "24px 0" };

const sectionTitle = {
  fontSize: 16,
  fontWeight: 600 as const,
  color: "#1a1a2e",
  marginBottom: 8,
};

const performerRow = {
  fontSize: 14,
  color: "#374151",
  margin: "4px 0",
};

const ctaText = {
  fontSize: 14,
  color: "#374151",
  textAlign: "center" as const,
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};

const footer = {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 24,
  textAlign: "center" as const,
};
