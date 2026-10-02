import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatCertificateCode } from '@lms/shared';

/** Everything printed on a certificate: the snapshot stored with it, never live data. */
export interface CertificateContent {
  code: string;
  learnerName: string;
  courseTitle: string;
  institute: string;
  /** Already formatted in the institute's time zone. */
  completedOn: string;
  issuedOn: string;
  /** The public page that confirms the certificate. */
  verifyUrl: string;
  /** Who signs it, as recorded at issue; no line is drawn without a name. */
  signatoryName?: string;
  signatoryTitle?: string;
}

// A4 landscape, in points.
const WIDTH = 842;
const HEIGHT = 595;
const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.38, 0.38, 0.4);
const ACCENT = rgb(0.48, 0.12, 0.17);

/**
 * The standard PDF fonts encode Western European characters only (WinAnsi). A character they
 * cannot draw is replaced rather than failing the whole certificate; names in other scripts need
 * an embedded Unicode font, which is a known limitation (ADR-0022).
 */
function printable(text: string, font: PDFFont, size: number): string {
  let out = '';
  for (const character of text) {
    try {
      font.widthOfTextAtSize(character, size);
      out += character;
    } catch {
      out += '?';
    }
  }
  return out;
}

/** Shrinks the size until the text fits the width, down to a floor. */
function fitted(text: string, font: PDFFont, size: number, maxWidth: number, floor = 12): number {
  let current = size;
  while (current > floor && font.widthOfTextAtSize(text, current) > maxWidth) current -= 1;
  return current;
}

function centred(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const safe = printable(text, font, size);
  const fit = fitted(safe, font, size, WIDTH - 160);
  const width = font.widthOfTextAtSize(safe, fit);
  page.drawText(safe, { x: (WIDTH - width) / 2, y, size: fit, font, color });
}

/** Draws the certificate: one landscape page, standard fonts only, no external resources. */
export async function drawCertificate(content: CertificateContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of completion: ${content.courseTitle}`);
  pdf.setAuthor(content.institute);
  pdf.setSubject(`Awarded to ${content.learnerName}`);
  pdf.setCreator(content.institute);
  pdf.setProducer(content.institute);
  pdf.setLanguage('en');

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([WIDTH, HEIGHT]);
  page.drawRectangle({
    x: 24,
    y: 24,
    width: WIDTH - 48,
    height: HEIGHT - 48,
    borderColor: ACCENT,
    borderWidth: 2.5,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: WIDTH - 68,
    height: HEIGHT - 68,
    borderColor: ACCENT,
    borderWidth: 0.75,
  });

  centred(page, content.institute.toUpperCase(), 500, sansBold, 13, ACCENT);
  centred(page, 'Certificate of Completion', 440, serifBold, 34);
  centred(page, 'This certifies that', 390, serif, 15, MUTED);
  centred(page, content.learnerName, 340, serifBold, 30);
  page.drawLine({
    start: { x: 220, y: 328 },
    end: { x: WIDTH - 220, y: 328 },
    thickness: 0.75,
    color: MUTED,
  });
  centred(page, 'has completed the course', 295, serif, 15, MUTED);
  centred(page, content.courseTitle, 250, serifBold, 22);
  centred(page, `Completed on ${content.completedOn}`, 205, sans, 12, MUTED);

  if (content.signatoryName) {
    page.drawLine({
      start: { x: WIDTH / 2 - 110, y: 140 },
      end: { x: WIDTH / 2 + 110, y: 140 },
      thickness: 0.75,
      color: MUTED,
    });
    centred(page, content.signatoryName, 122, sansBold, 11);
    if (content.signatoryTitle) centred(page, content.signatoryTitle, 107, sans, 10, MUTED);
  }

  const code = formatCertificateCode(content.code);
  page.drawText(printable(`Certificate ${code}`, sansBold, 10), {
    x: 60,
    y: 92,
    size: 10,
    font: sansBold,
    color: INK,
  });
  page.drawText(printable(`Issued on ${content.issuedOn}`, sans, 10), {
    x: 60,
    y: 76,
    size: 10,
    font: sans,
    color: MUTED,
  });
  const verify = printable(`Verify at ${content.verifyUrl}`, sans, 10);
  const verifySize = fitted(verify, sans, 10, WIDTH / 2 - 80, 7);
  page.drawText(verify, {
    x: WIDTH - 60 - sans.widthOfTextAtSize(verify, verifySize),
    y: 76,
    size: verifySize,
    font: sans,
    color: MUTED,
  });

  return pdf.save();
}
