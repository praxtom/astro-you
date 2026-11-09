/**
 * Minimal dependency-free PDF writer for text reports: a title, section
 * headings and wrapped paragraphs, flowing across as many pages as needed.
 * Uses the standard Helvetica fonts, which only cover printable ASCII here,
 * so text is normalised (smart quotes, dashes, emoji) before it is written.
 */

/** A paragraph, a blank line (""), or a heading. */
export type PdfBlock = string | { heading: string } | { subheading: string };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 50;
const TOP_Y = 750;
const BOTTOM_Y = 60;
/** Hard ceiling so a runaway payload can't produce a giant file. */
const MAX_PAGES = 40;

interface Line {
  text: string;
  font: "F1" | "F2";
  size: number;
  /** Vertical space this line takes, including the gap above it. */
  advance: number;
}

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[–—−]/g, "-"],
  [/…/g, "..."],
  [/[•·]/g, "-"],
  [/₹/g, "Rs."],
  [/\u00A0/g, " "],
];

/** Map text onto the printable-ASCII subset the built-in fonts render. */
export function toPdfSafeText(text: string): string {
  let out = String(text ?? "");
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Strip accents (e.g. "Mithuna" spellings with diacritics), then drop
  // anything still outside printable ASCII (emoji, Devanagari, etc).
  out = out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  out = out.replace(/[^\x20-\x7E\n]/g, "");
  return out.replace(/[ \t]+/g, " ").trim();
}

export function createTextPdf(title: string, blocks: PdfBlock[]): ArrayBuffer {
  const lines: Line[] = [];
  for (const titleLine of wrapText(toPdfSafeText(title), 48)) {
    lines.push({ text: titleLine, font: "F2", size: 18, advance: 24 });
  }
  lines.push({ text: "", font: "F1", size: 11, advance: 8 });

  for (const block of blocks) {
    if (typeof block === "string") {
      const safe = toPdfSafeText(block);
      if (!safe) {
        lines.push({ text: "", font: "F1", size: 11, advance: 8 });
        continue;
      }
      wrapText(safe, 92).forEach((text) =>
        lines.push({ text, font: "F1", size: 11, advance: 15 }),
      );
      lines.push({ text: "", font: "F1", size: 11, advance: 6 });
    } else if ("heading" in block) {
      wrapText(toPdfSafeText(block.heading), 64).forEach((text, i) =>
        lines.push({ text, font: "F2", size: 14, advance: i === 0 ? 26 : 18 }),
      );
    } else {
      wrapText(toPdfSafeText(block.subheading), 80).forEach((text, i) =>
        lines.push({
          text,
          font: "F2",
          size: 11.5,
          advance: i === 0 ? 18 : 15,
        }),
      );
    }
  }

  // Flow lines onto pages.
  const pages: string[][] = [];
  let current: string[] = [];
  let y = TOP_Y + 24; // first line's advance brings it to TOP_Y
  let truncated = false;
  for (const line of lines) {
    const nextY = y - line.advance;
    if (nextY < BOTTOM_Y) {
      pages.push(current);
      if (pages.length >= MAX_PAGES) {
        truncated = true;
        break;
      }
      current = [];
      y = TOP_Y + line.size + 4;
    }
    y -= line.advance;
    if (line.text) {
      current.push(
        `BT /${line.font} ${line.size} Tf ${MARGIN_X} ${y.toFixed(1)} Td (${escapePdfText(line.text)}) Tj ET`,
      );
    }
  }
  if (!truncated) pages.push(current);
  if (truncated) {
    const last = pages[pages.length - 1];
    last.push(
      `BT /F1 10 Tf ${MARGIN_X} ${BOTTOM_Y - 20} Td (${escapePdfText("... continued - open the full report in the AstroYou app")}) Tj ET`,
    );
  }

  const pageCount = pages.length;
  pages.forEach((ops, index) => {
    ops.push(
      `BT /F1 9 Tf ${PAGE_WIDTH - MARGIN_X - 60} 30 Td (${escapePdfText(`Page ${index + 1} of ${pageCount}`)}) Tj ET`,
    );
    ops.push(
      `BT /F1 9 Tf ${MARGIN_X} 30 Td (${escapePdfText("AstroYou")}) Tj ET`,
    );
  });

  // Objects: 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, then a
  // (page, content) pair per page.
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, i) => 5 + i * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  pages.forEach((ops, i) => {
    const contentId = pageObjectIds[i] + 1;
    const content = ops.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  // All content is ASCII, so string length == byte length (xref offsets hold).
  return new TextEncoder().encode(pdf).buffer as ArrayBuffer;
}

function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    // Hard-break a single word longer than the line (URLs, ids).
    while (word.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
