// PDF plumbing shared by receipts, statements, payslips and reports. Uses DejaVu Sans when present
// (it has the ₦ glyph); otherwise falls back to Helvetica and prints the currency code instead.
import PDFDocument from "pdfkit";

export type Pdf = PDFKit.PDFDocument;

let fontPaths: { regular: string; bold: string } | null | undefined;

function resolveFonts(): { regular: string; bold: string } | null {
  if (fontPaths !== undefined) return fontPaths;
  try {
    fontPaths = {
      regular: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"),
      bold: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"),
    };
  } catch {
    fontPaths = null;
  }
  return fontPaths;
}

export interface PdfOptions {
  size?: string | [number, number];
  layout?: "portrait" | "landscape";
  margin?: number;
  title: string;
}

export interface PdfHandle {
  doc: Pdf;
  /** True when the embedded font can print the ₦ sign. */
  unicode: boolean;
  regular: string;
  bold: string;
  done: () => Promise<Buffer>;
}

export function createPdf(options: PdfOptions): PdfHandle {
  const doc = new PDFDocument({
    size: options.size ?? "A4",
    layout: options.layout ?? "portrait",
    margin: options.margin ?? 36,
    bufferPages: true,
    info: { Title: options.title, Producer: "ShowroomPro" },
  });
  const fonts = resolveFonts();
  if (fonts) {
    doc.registerFont("Body", fonts.regular);
    doc.registerFont("Body-Bold", fonts.bold);
  }
  const regular = fonts ? "Body" : "Helvetica";
  const bold = fonts ? "Body-Bold" : "Helvetica-Bold";
  doc.font(regular);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return {
    doc,
    unicode: Boolean(fonts),
    regular,
    bold,
    done: async () => {
      doc.end();
      return finished;
    },
  };
}

/** Footer with page numbers on every buffered page. */
export function addPageNumbers(handle: PdfHandle, label: string): void {
  const { doc } = handle;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom + 12;
    doc
      .font(handle.regular)
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(`${label} · Page ${i + 1} of ${range.count}`, doc.page.margins.left, bottom, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false,
      });
  }
}
