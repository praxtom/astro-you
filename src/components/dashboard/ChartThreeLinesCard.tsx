import type { ReactNode } from "react";
import { buildChartThreeLines, type ChartLike } from "../../lib/chart-summary";
import type { DashaPeriodSummary } from "../../hooks/useDashaPeriods";
import { PersonalCardNotice } from "./PersonalCardNotice";
import { GlossaryTerm } from "../ui/GlossaryTerm";
import type { PersonalDataErrorKind } from "../../lib/personal-data-error";
import {
  DashSection,
  Fact,
  FactSkeleton,
  Ledger,
  TextAction,
} from "./primitives";

interface ChartThreeLinesCardProps {
  kundali: ChartLike | null;
  kundaliLoading: boolean;
  nakshatra?: string | null;
  dashaPeriods: DashaPeriodSummary[];
  dashaLoading: boolean;
  errorKind?: PersonalDataErrorKind | null;
  onRetry?: () => void;
  /** Link to the full chart page (off when already on it). */
  showFullChartLink?: boolean;
  /** Render only the ledger, for use inside a larger dashboard section. */
  bare?: boolean;
  /** Show only these lines (default: all three). */
  include?: Array<"Moon" | "Lagna" | "Mahadasha">;
  /** Extra detail rendered under the Moon line (e.g. the birth star's deity and ruler). */
  moonDetail?: ReactNode;
  /** Extra ledger cells appended after the lines (e.g. yogas). */
  extraCells?: ReactNode[];
}

/**
 * Plain-language labels for the three lines. The line ids ("Moon", "Lagna",
 * "Mahadasha") stay as they are for `include`; only the visible label changes.
 */
const LINE_LABELS: Record<string, ReactNode> = {
  Moon: "Moon sign",
  Lagna: <GlossaryTerm k="lagna">Rising sign (Lagna)</GlossaryTerm>,
  Mahadasha: (
    <GlossaryTerm k="mahadasha">Current life chapter</GlossaryTerm>
  ),
};

/**
 * First personal insight on the dashboard: Moon + nakshatra, Lagna and the
 * running Mahadasha, one plain-language line each, as a three-cell ledger.
 * Built only from data the dashboard already loads (D1, NAKSHATRA, DASHAS).
 */
export function ChartThreeLinesCard({
  kundali,
  kundaliLoading,
  nakshatra,
  dashaPeriods,
  dashaLoading,
  errorKind,
  onRetry,
  showFullChartLink = true,
  bare = false,
  include,
  moonDetail,
  extraCells = [],
}: ChartThreeLinesCardProps) {
  const lines = buildChartThreeLines({ kundali, nakshatra, dashaPeriods }).filter(
    (line) => !include || include.includes(line.label as "Moon" | "Lagna" | "Mahadasha"),
  );
  const expected = include ? include.length : 3;
  const stillLoading = (kundaliLoading || dashaLoading) && lines.length < expected;

  const content = (
    <>
      {lines.length > 0 || stillLoading || extraCells.length > 0 ? (
        <Ledger cols={3}>
          {lines.map((line) => (
            <Fact
              key={line.label}
              label={LINE_LABELS[line.label] ?? line.label}
              value={line.value}
              note={line.meaning}
            >
              {line.label === "Moon" && moonDetail}
            </Fact>
          ))}
          {stillLoading &&
            Array.from({ length: Math.max(0, expected - lines.length) }, (_, i) => (
              <FactSkeleton key={`s${i}`} />
            ))}
          {extraCells}
        </Ledger>
      ) : (
        <div>
          <PersonalCardNotice
            kind={errorKind ?? "unavailable"}
            thing="chart summary"
            onRetry={onRetry}
          />
        </div>
      )}
    </>
  );

  if (bare) return content;

  return (
    <DashSection
      id="chart-three-lines-title"
      title="Your chart in three lines"
      aside={
        showFullChartLink && lines.length > 0 ? (
          <TextAction to="/reports">See my full chart</TextAction>
        ) : undefined
      }
    >
      {content}
    </DashSection>
  );
}
