import type { CampaignAffiliate, CriteriaField } from "@/lib/types";
import { fetchPostingInstructionsPayload } from "@/lib/api";
import React from "react";

export interface PostingInstructionsInput {
  campaignId: string;
  affiliateId: string;
}

function typeLabel(field: CriteriaField): string {
  if (field.data_type === "List") {
    return "List";
  }
  if (field.data_type === "US State") {
    // Keep the PDF language simple for affiliates; state mapping is internal.
    return "Text";
  }
  return field.data_type;
}

function fieldNotes(field: CriteriaField): string {
  const notes: string[] = [];
  if (field.description) notes.push(field.description);
  if (field.data_type === "List" && field.options?.length) {
    notes.push(
      `Valid responses: ${field.options.map((o) => o.value).join(", ")}`,
    );
  }
  return notes.join(" | ");
}

function buildExamplePayload(
  campaignId: string,
  campaignKey: string,
  fields: CriteriaField[],
): Record<string, unknown> {
  const inner: Record<string, unknown> = {};
  for (const f of fields) {
    // skip top-level auth fields if they appear in criteria to avoid duplicates
    if (f.field_name === "campaign_id" || f.field_name === "campaign_key")
      continue;
    switch (f.data_type) {
      case "Text":
        inner[f.field_name] =
          f.field_name === "email"
            ? "john.doe@example.com"
            : f.field_name === "phone"
              ? "5551234567"
              : `Example ${f.field_label}`;
        break;
      case "Number":
        inner[f.field_name] = 0;
        break;
      case "Boolean":
        inner[f.field_name] = true;
        break;
      case "Date":
        inner[f.field_name] = "1990-01-01";
        break;
      case "List":
        inner[f.field_name] = f.options?.[0]?.value ?? "option_value";
        break;
      case "US State":
        inner[f.field_name] =
          f.state_mapping === "abbr_to_name" ? "CA" : "California";
        break;
      default:
        inner[f.field_name] = "";
    }
  }
  return { campaign_id: campaignId, campaign_key: campaignKey, ...inner };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  green600: "#16a34a",
  blue500: "#3b82f6",
  red600: "#dc2626",
  red100: "#fee2e2",
  red800: "#991b1b",
  amber500: "#f59e0b",
};

async function loadImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generatePostingInstructions({
  campaignId,
  affiliateId,
}: PostingInstructionsInput): Promise<void> {
  const res = await fetchPostingInstructionsPayload(campaignId, affiliateId);
  if (!res?.success || !res.data) {
    throw new Error(res?.message || "Failed to fetch posting instructions");
  }
  const { campaign, affiliate, criteria_fields } = res.data;

  // Adapt to the shapes the PDF builder expects
  const link = {
    campaign_key: affiliate.campaign_key,
    status: affiliate.link_status,
  } as unknown as CampaignAffiliate;
  const criteriaFields = criteria_fields as CriteriaField[];

  const { pdf, Document, Page, View, Text, Image, StyleSheet } =
    await import("@react-pdf/renderer");

  let logoData: string | null = null;
  try {
    logoData = await loadImageAsBase64("/logo_2.png");
  } catch {
    // logo unavailable — skip
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isCampaignTest =
    (campaign as any).status !== "ACTIVE" || link.status !== "LIVE";

  const sortedFields = [...criteriaFields].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const submitUrl =
    (campaign as any).submit_url ??
    "https://iq8bhm0nf6.execute-api.us-east-1.amazonaws.com/dev/v2/leads";

  const exampleJson = JSON.stringify(
    buildExamplePayload(campaign.id, link.campaign_key, sortedFields),
    null,
    2,
  );

  const s = StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      fontSize: 9,
      color: C.slate900,
      paddingTop: 22,
      paddingBottom: 30,
      paddingHorizontal: 28,
      backgroundColor: C.white,
    },
    footer: {
      position: "absolute",
      bottom: 14,
      left: 28,
      right: 28,
      textAlign: "center",
      fontSize: 7,
      color: C.slate500,
      borderTopWidth: 0.5,
      borderTopColor: C.slate200,
      paddingTop: 4,
    },
    // Header
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    companyName: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: C.slate700,
    },
    companySubtitle: { fontSize: 7.5, color: C.slate500, marginTop: 1 },
    headerDate: { fontSize: 7.5, color: C.slate500 },
    // Title banner
    titleBanner: {
      backgroundColor: C.slate800,
      borderRadius: 4,
      paddingVertical: 9,
      paddingHorizontal: 10,
      marginBottom: 16,
    },
    titleText: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.white },
    titleSub: { fontSize: 9.5, color: "#cbd5e1", marginTop: 3 },
    // Section heading
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 7,
      marginTop: 14,
    },
    sectionLabel: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: C.slate700,
      letterSpacing: 0.8,
      marginRight: 6,
    },
    sectionLine: { flex: 1, height: 0.5, backgroundColor: C.slate200 },
    // Info rows
    infoRow: { flexDirection: "row", marginBottom: 4 },
    infoLabel: { width: 76, fontSize: 8.5, color: C.slate500 },
    infoValue: {
      flex: 1,
      fontSize: 8.5,
      fontFamily: "Helvetica-Bold",
      color: C.slate900,
    },
    infoMono: {
      flex: 1,
      fontSize: 8.5,
      fontFamily: "Courier",
      color: C.slate900,
    },
    // TEST banner
    testBanner: {
      backgroundColor: C.red100,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: C.red600,
      padding: 8,
      marginBottom: 10,
    },
    testBannerTitle: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: C.red600,
      marginBottom: 2,
    },
    testBannerBody: { fontSize: 8, color: C.red800 },
    // Endpoint box
    endpointBox: {
      backgroundColor: C.slate100,
      borderRadius: 4,
      paddingVertical: 7,
      paddingHorizontal: 8,
      marginBottom: 3,
      flexDirection: "row",
      alignItems: "center",
    },
    endpointLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", width: 26 },
    methodBadge: {
      borderRadius: 3,
      paddingVertical: 2,
      paddingHorizontal: 5,
      marginLeft: 4,
    },
    methodText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.white },
    endpointUrl: {
      fontSize: 7.5,
      fontFamily: "Courier",
      color: C.slate900,
      flex: 1,
      marginLeft: 6,
    },
    endpointNote: {
      fontSize: 7.5,
      color: C.slate500,
      marginBottom: 10,
      paddingLeft: 2,
    },
    endpointNoteHighlight: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Bold",
      color: C.blue500,
      marginBottom: 10,
      paddingLeft: 2,
    },
    // Request structure
    structureGroupLabel: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: C.slate700,
      marginBottom: 3,
      marginTop: 6,
    },
    structureRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 10 },
    structureKey: {
      width: 90,
      fontSize: 8,
      fontFamily: "Courier",
      color: C.slate900,
    },
    structureVal: { flex: 1, fontSize: 8, color: C.slate500 },
    authNote: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Oblique",
      color: C.slate500,
      marginTop: 6,
      marginBottom: 2,
    },
    // Fields table
    tableHeader: {
      flexDirection: "row",
      backgroundColor: C.slate800,
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderRadius: 3,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: C.slate200,
    },
    tableRowAlt: { backgroundColor: C.slate50 },
    thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.white },
    tdText: { fontSize: 7.5, color: C.slate900 },
    tdMono: { fontSize: 7.5, fontFamily: "Courier", color: C.slate900 },
    colFieldName: { width: 102, paddingRight: 8 },
    colLabel: { width: 92, paddingRight: 8 },
    colType: { width: 56, paddingRight: 8 },
    colReq: { width: 34, textAlign: "center" },
    reqYes: { color: C.green600, fontFamily: "Helvetica-Bold" },
    reqNo: { color: C.red600 },
    colNotes: { flex: 1 },
    // Code block
    codeBlock: {
      backgroundColor: C.slate100,
      borderRadius: 4,
      padding: 8,
      marginBottom: 10,
    },
    codeLine: {
      fontSize: 7.5,
      fontFamily: "Courier",
      color: C.slate900,
      lineHeight: 1.5,
    },
    // Response box
    responseBox: { marginBottom: 10 },
    responseTitle: {
      fontSize: 8.5,
      fontFamily: "Helvetica-Bold",
      marginBottom: 4,
    },
    // FAQ
    faqItem: { marginBottom: 8 },
    faqQ: {
      fontSize: 8.5,
      fontFamily: "Helvetica-Bold",
      color: C.slate900,
      marginBottom: 2,
    },
    faqA: { fontSize: 8, color: C.slate500, lineHeight: 1.45 },
    // Contact
    contactText: {
      fontSize: 8.5,
      color: C.slate900,
      lineHeight: 1.5,
      marginBottom: 6,
    },
    contactMeta: {
      fontSize: 8,
      fontFamily: "Courier",
      color: C.slate500,
      marginBottom: 2,
    },
  });

  // ── Small helper components ───────────────────────────────────────────────

  const e = React.createElement;

  function SectionHeading({ title }: { title: string }) {
    return e(
      View,
      { style: s.sectionHeading },
      e(Text, { style: s.sectionLabel }, title.toUpperCase()),
      e(View, { style: s.sectionLine }),
    );
  }

  function EndpointRow({
    label,
    url,
    color,
    note,
    highlightNote,
  }: {
    label: string;
    url: string;
    color: string;
    note?: string;
    highlightNote?: boolean;
  }) {
    return e(
      View,
      null,
      e(
        View,
        { style: s.endpointBox },
        e(Text, { style: [s.endpointLabel, { color }] }, label),
        e(
          View,
          { style: [s.methodBadge, { backgroundColor: color }] },
          e(Text, { style: s.methodText }, "POST"),
        ),
        e(Text, { style: s.endpointUrl }, url),
      ),
      note
        ? e(
            Text,
            { style: highlightNote ? s.endpointNoteHighlight : s.endpointNote },
            note,
          )
        : null,
    );
  }

  function CodeBlock({ content }: { content: string }) {
    return e(
      View,
      { style: s.codeBlock },
      e(Text, { style: s.codeLine }, content),
    );
  }

  function ResponseBox({
    title,
    color,
    json,
  }: {
    title: string;
    color: string;
    json: object;
  }) {
    return e(
      View,
      { style: s.responseBox },
      e(Text, { style: [s.responseTitle, { color }] }, title),
      e(
        View,
        { style: s.codeBlock },
        e(Text, { style: s.codeLine }, JSON.stringify(json, null, 2)),
      ),
    );
  }

  // ── Document ─────────────────────────────────────────────────────────────

  const docElement = e(
    Document,
    {
      title: `Posting Instructions — ${affiliate.name}`,
      author: "Summit Edge Legal",
    },

    e(
      Page,
      { size: "A4", style: s.page },

      // Fixed footer on every page
      e(
        Text,
        { style: s.footer, fixed: true },
        "Summit Edge Legal — Confidential",
      ),

      // ── Header ──
      e(
        View,
        { style: s.headerRow },
        e(
          View,
          { style: { flexDirection: "row", alignItems: "center" } },
          logoData
            ? e(Image, {
                src: logoData,
                style: { width: 26, height: 26, marginRight: 8 },
              })
            : null,
          e(
            View,
            null,
            e(Text, { style: s.companyName }, "Summit Edge Legal"),
            e(Text, { style: s.companySubtitle }, "Lead Management Platform"),
          ),
        ),
        e(Text, { style: s.headerDate }, `Generated: ${dateStr}`),
      ),

      // ── Title banner ──
      e(
        View,
        { style: s.titleBanner },
        e(Text, { style: s.titleText }, "Posting Instructions"),
        e(Text, { style: s.titleSub }, `Source: ${affiliate.name}`),
      ),

      // ── Campaign ──
      e(SectionHeading, { title: "Campaign" }),
      e(
        View,
        { style: s.infoRow },
        e(Text, { style: s.infoLabel }, "Name"),
        e(Text, { style: s.infoValue }, campaign.name),
      ),
      e(
        View,
        { style: s.infoRow },
        e(Text, { style: s.infoLabel }, "Campaign ID"),
        e(Text, { style: s.infoMono }, campaign.id),
      ),
      e(
        View,
        { style: s.infoRow },
        e(Text, { style: s.infoLabel }, "Campaign Key"),
        e(Text, { style: s.infoMono }, link.campaign_key),
      ),

      // ── API Endpoints ──
      e(SectionHeading, { title: "API Endpoints" }),

      isCampaignTest &&
        e(
          View,
          { style: s.testBanner },
          e(Text, { style: s.testBannerTitle }, "⚠  TEST MODE"),
          e(
            Text,
            { style: s.testBannerBody },
            "This source is currently in TEST mode. Leads sent will be treated as test traffic automatically. No separate test endpoint is needed.",
          ),
        ),

      e(EndpointRow, {
        label: "POST",
        url: submitUrl,
        color: C.green600,
        note: isCampaignTest
          ? "Test leads are auto-detected when your source status is TEST."
          : undefined,
      }),

      // ── Request Structure ──
      e(SectionHeading, { title: "Request Structure" }),
      e(Text, { style: s.structureGroupLabel }, "Headers"),
      e(
        View,
        { style: s.structureRow },
        e(Text, { style: s.structureKey }, "Content-Type"),
        e(Text, { style: s.structureVal }, "application/json"),
      ),
      e(Text, { style: s.structureGroupLabel }, "Body"),
      e(
        View,
        { style: s.structureRow },
        e(Text, { style: s.structureKey }, "campaign_id"),
        e(
          Text,
          { style: s.structureVal },
          "Your campaign ID — see Campaign section above",
        ),
      ),
      e(
        View,
        { style: s.structureRow },
        e(Text, { style: s.structureKey }, "campaign_key"),
        e(
          Text,
          { style: s.structureVal },
          "Your unique source key — see Campaign section above",
        ),
      ),
      e(
        Text,
        { style: s.authNote },
        "Lead fields go directly in the request body alongside campaign_id and campaign_key — not nested. If leads are not being accepted, verify campaign_id and campaign_key match exactly.",
      ),

      // ── Lead Fields ──
      e(SectionHeading, { title: "Lead Fields" }),
      e(
        View,
        null,
        e(
          View,
          { style: s.tableHeader },
          e(Text, { style: [s.thText, s.colFieldName] }, "Field Name"),
          e(Text, { style: [s.thText, s.colLabel] }, "Label"),
          e(Text, { style: [s.thText, s.colType] }, "Type"),
          e(Text, { style: [s.thText, s.colReq] }, "Req."),
          e(Text, { style: [s.thText, s.colNotes] }, "Notes"),
        ),
        ...(sortedFields.length === 0
          ? [
              e(
                View,
                { style: s.tableRow },
                e(
                  Text,
                  { style: [s.tdText, { flex: 1 }] },
                  "No fields defined",
                ),
              ),
            ]
          : sortedFields.map((f, idx) =>
              e(
                View,
                {
                  key: f.field_name,
                  style: [
                    s.tableRow,
                    ...(idx % 2 === 1 ? [s.tableRowAlt] : []),
                  ],
                },
                e(Text, { style: [s.tdMono, s.colFieldName] }, f.field_name),
                e(Text, { style: [s.tdText, s.colLabel] }, f.field_label),
                e(Text, { style: [s.tdText, s.colType] }, typeLabel(f)),
                e(
                  Text,
                  {
                    style: [
                      s.tdText,
                      s.colReq,
                      ...(f.required ? [s.reqYes] : [s.reqNo]),
                    ],
                  },
                  f.required ? "Yes" : "No",
                ),
                e(Text, { style: [s.tdText, s.colNotes] }, fieldNotes(f)),
              ),
            )),
      ),

      // ── Example Request ──
      e(
        View,
        { break: true },
        e(SectionHeading, { title: "Example Request" }),
        e(CodeBlock, { content: exampleJson }),
      ),

      // ── Example Responses ──
      e(SectionHeading, { title: "Example Responses" }),
      e(ResponseBox, {
        title: "Accepted",
        color: C.green600,
        json: {
          success: true,
          message: "Lead accepted",
          data: {
            id: "LDABC12345",
            test: false,
            duplicate: false,
            rejected: false,
            rejection_reason: null,
            message: "Your lead has been received and accepted.",
          },
        },
      }),
      e(ResponseBox, {
        title: "Rejected (validation / rule)",
        color: C.red600,
        json: {
          result: "failed",
          lead_id: "LDABC12346",
          msg: "Lead Rejected",
          errors: ["Last Name is required", "state must equal California"],
        },
      }),
      e(ResponseBox, {
        title: "Test traffic auto-detected",
        color: C.amber500,
        json: {
          result: "passed",
          message: "Test lead accepted",
          data: {
            lead_id: "LDABC12347",
            message: "Test lead accepted – no delivery",
          },
        },
      }),

      // ── Sending Test Leads ──
      e(SectionHeading, { title: "Sending Test Leads" }),
      e(
        View,
        {
          style: {
            backgroundColor: C.slate100,
            borderRadius: 4,
            padding: 10,
            marginBottom: 8,
          },
        },
        e(
          Text,
          { style: { fontSize: 9.5, color: C.slate800, lineHeight: 1.5 } },
          "You can send test leads at any time — even while the campaign is LIVE. To mark a lead as test traffic, include the word ",
        ),
        e(
          Text,
          {
            style: {
              fontSize: 9.5,
              color: C.slate800,
              fontFamily: "Courier",
              fontWeight: 700,
            },
          },
          "test",
        ),
        e(
          Text,
          { style: { fontSize: 9.5, color: C.slate800, lineHeight: 1.5 } },
          " in any of the validated fields (e.g. first name, last name, email, etc.). The system will automatically detect the lead as test traffic and process it accordingly — it will not be forwarded to clients or count against your lead cap.",
        ),
      ),
      e(
        Text,
        { style: { fontSize: 9, color: C.slate500, marginBottom: 4 } },
        'Example: set first_name to "Test" or email to "test@example.com".',
      ),
      e(
        Text,
        { style: { fontSize: 9, color: C.slate500 } },
        "Test leads appear in reporting with a test flag so you can verify your integration is working end to end.",
      ),

      // ── FAQs ──
      e(
        View,
        { break: true },
        e(SectionHeading, { title: "Frequently Asked Questions" }),
        ...[
          {
            q: "My leads are being rejected with authentication errors.",
            a: "Verify that campaign_id and campaign_key are correct and match exactly. These are the only authentication mechanism — there is no API key.",
          },
          {
            q: "I get a 404 or connection error.",
            a: "Confirm you are posting to the correct endpoint URL. There is a single unified endpoint for both test and live traffic.",
          },
          {
            q: "My leads are accepted but not appearing in live reporting.",
            a: "Your source status may still be in TEST mode. Leads from TEST sources are not forwarded to clients. Contact your campaign manager to promote your status to LIVE.",
          },
          {
            q: "I receive required field validation errors.",
            a: "Ensure all required fields listed in the Lead Fields section are present in the request body. Field names are case-sensitive.",
          },
          {
            q: "Leads are being rejected as duplicates.",
            a: "A lead with the same phone number or email address already exists in the system.",
          },
        ].map(({ q, a }, i) =>
          e(
            View,
            { key: String(i), style: s.faqItem },
            e(Text, { style: s.faqQ }, `Q: ${q}`),
            e(Text, { style: s.faqA }, `A: ${a}`),
          ),
        ),
      ),

      // ── Contact ──
      e(SectionHeading, { title: "Contact Us" }),
      e(
        Text,
        { style: s.contactText },
        "For any questions or issues during integration testing, please contact Summit Edge Legal. Reference your Campaign ID and Source ID in all correspondence.",
      ),
      e(Text, { style: s.contactMeta }, `Campaign ID: ${campaign.id}`),
      e(Text, { style: s.contactMeta }, `Source ID: ${affiliate.id}`),
      e(Text, { style: s.contactMeta }, "jeff.flores@summitedgelegal.com"),
    ),
  );

  // ── Render → blob → download ─────────────────────────────────────────────
  const blob = await pdf(docElement).toBlob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `posting-instructions-${affiliate.name.toLowerCase().replace(/\s+/g, "-")}-${campaign.id}.pdf`;
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}
