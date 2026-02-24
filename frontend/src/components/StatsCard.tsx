import type { AnalysisMetadata } from "../types";

interface StatsCardProps {
  metadata: AnalysisMetadata;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtCost(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: "#111827",
        paddingBottom: "6px",
        borderBottom: "1px solid #F3F4F6",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

function DataRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "4px 0",
        fontSize: "12px",
      }}
    >
      <span style={{ color: "#6B7280", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#111827", fontWeight: 400, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "16px 0" }}
    />
  );
}

export default function StatsCard({ metadata }: StatsCardProps) {
  const remaining = metadata.impervious_budget_remaining_pct;
  const barColor =
    remaining > 20 ? "#10B981" : remaining > 5 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div>
        <SectionHeading>Impervious Cover</SectionHeading>
        <div
          style={{
            height: "6px",
            backgroundColor: "#E5E7EB",
            borderRadius: "3px",
            overflow: "hidden",
            marginBottom: "6px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, metadata.impervious_pct)}%`,
              backgroundColor: barColor,
              borderRadius: "3px",
              transition: "width 0.3s",
            }}
          />
        </div>
        <DataRow
          label="Used"
          value={`${metadata.impervious_pct.toFixed(1)}%`}
        />
        <DataRow label="Remaining" value={`${remaining.toFixed(1)}%`} />
        <DataRow
          label="Available area"
          value={`${fmt(metadata.impervious_budget_remaining_sqft)} sq ft`}
        />
      </div>

      <Divider />

      <div>
        <SectionHeading>Demolition</SectionHeading>
        <div
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#111827",
            lineHeight: "1.2",
            marginBottom: "4px",
          }}
        >
          {fmtCost(metadata.demo_cost_estimate)}
        </div>
        <div
          style={{ fontSize: "12px", color: "#6B7280", marginBottom: "4px" }}
        >
          {metadata.building_count} building
          {metadata.building_count !== 1 ? "s" : ""} &middot;{" "}
          {fmt(metadata.demo_sqft)} sq ft
        </div>
        {metadata.demo_cost_hazmat > 0 && (
          <div style={{ fontSize: "12px", color: "#6B7280" }}>
            ⚠️ Includes {fmtCost(metadata.demo_cost_hazmat)} hazmat surcharge
          </div>
        )}
      </div>

      <Divider />

      <div>
        <SectionHeading>Protected Root Zones</SectionHeading>
        <DataRow
          label="Protected area"
          value={`${fmt(metadata.crz_sqft)} sq ft`}
        />
      </div>

      {Object.keys(metadata.landuse_breakdown).length > 0 && (
        <>
          <Divider />
          <div>
            <SectionHeading>Land Use (OSM)</SectionHeading>
            {Object.entries(metadata.landuse_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([type, sqft]) => {
                const pct =
                  metadata.total_area_sqft > 0
                    ? ((sqft / metadata.total_area_sqft) * 100).toFixed(0)
                    : "0";
                return (
                  <DataRow
                    key={type}
                    label={type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                    value={`${fmt(sqft)} sq ft (${pct}%)`}
                  />
                );
              })}
          </div>
        </>
      )}

      <Divider />

      <div>
        <SectionHeading>Buildable Area</SectionHeading>
        <DataRow
          label="Gross (excl. CRZ)"
          value={`${fmt(metadata.buildable_gross_sqft)} sq ft`}
        />
        <DataRow
          label="Setback deduction"
          value={`−${fmt(metadata.setback_sqft)} sq ft`}
          valueStyle={{ color: "#EF4444" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "5px 0",
            fontSize: "14px",
            borderTop: "1px solid #E5E7EB",
            marginTop: "4px",
          }}
        >
          <span style={{ color: "#111827", fontWeight: 600 }}>
            Net buildable
          </span>
          <span style={{ color: "#111827", fontWeight: 600 }}>
            {fmt(metadata.buildable_net_sqft)} sq ft
          </span>
        </div>
        <DataRow
          label="Post-demo (after clearing)"
          value={`${fmt(metadata.buildable_post_demo_sqft)} sq ft`}
        />
      </div>

      <Divider />

      <div>
        <SectionHeading>Development Value Est.</SectionHeading>
        <DataRow
          label={`Gross (${fmtCost(metadata.dev_price_per_sqft)}/sq ft)`}
          value={fmtCost(metadata.dev_value_gross)}
        />
        {metadata.demo_cost_estimate > 0 && (
          <DataRow
            label="Demo costs"
            value={`−${fmtCost(metadata.demo_cost_estimate)}`}
            valueStyle={{ color: "#EF4444" }}
          />
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "5px 0",
            borderTop: "1px solid #E5E7EB",
            marginTop: "4px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#111827", fontWeight: 500 }}>
            Net value
          </span>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#10B981",
              lineHeight: "1.2",
            }}
          >
            {fmtCost(metadata.dev_value_net)}
          </span>
        </div>
      </div>

      <Divider />

      <div style={{ fontSize: "11px", color: "#9CA3AF" }}>
        {fmt(metadata.total_area_sqft)} sq ft total &middot;{" "}
        {metadata.tiles_processed} tiles &middot;{" "}
        {(metadata.processing_time_ms / 1000).toFixed(1)}s
      </div>
    </div>
  );
}
