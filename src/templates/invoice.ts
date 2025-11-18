import rawTemplate from "./invoice-template.html?raw";
import headerImageUrl from "@/assets/invoice_header.jpg?url";
import footerImageUrl from "@/assets/invoice_footer.jpg?url";
import { Sale, Client, SaleItem } from "@/types";
import { isReactiveType } from "@/lib/utils";
import { COMPANY_INFO } from "./company-info";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const amountFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const replaceNarrowSpaces = (input: string) =>
  input.replace(/\u202F/g, " ").replace(/\u00A0/g, " ");

const formatNumber = (value: number) => replaceNarrowSpaces(amountFormatter.format(value));

const formatCurrency = (value: number) => `${formatNumber(value)} Dirhams`;

const formatQuantity = (value: number) => (Number.isInteger(value) ? `${value}` : formatNumber(value));

const resolveAssetUrl = (assetPath: string) => {
  if (/^(data:|https?:|file:)/i.test(assetPath)) {
    return assetPath;
  }

  try {
    return new URL(assetPath, window.location.href).toString();
  } catch (error) {
    console.error("Failed to resolve asset URL", assetPath, error);
    return assetPath;
  }
};

const formatReactivePeriod = (item: SaleItem) => {
  if (!item.reactiveStartDate || !item.reactiveEndDate) {
    return null;
  }
  const start = new Date(item.reactiveStartDate);
  const end = new Date(item.reactiveEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return `Periode : ${start.toLocaleDateString("fr-FR")} au ${end.toLocaleDateString("fr-FR")}`;
};

const displayTypeLabel = (type: string) =>
  isReactiveType(type) ? "Produit reactif" : `Type : ${type}`;

export const formatInvoiceNumberDisplay = (invoiceNumber: string) => {
  const parts = invoiceNumber.split("-");
  if (
    parts.length >= 3 &&
    /^\d{4}$/.test(parts[parts.length - 2]) &&
    /^\d+$/.test(parts[parts.length - 1])
  ) {
    const year = parts[parts.length - 2];
    const sequence = parts[parts.length - 1];
    return `${sequence}/${year}`;
  }

  const match = invoiceNumber.match(/(\d{4})[-_/](\d+)$/);
  if (match) {
    const [, year, sequence] = match;
    return `${sequence}/${year}`;
  }

  return invoiceNumber;
};

const buildItemsTable = (sale: Sale) => {
  if (sale.items.length === 0) {
    return `
      <table class="items-table">
        <thead>
          <tr>
            <th>Code produit</th>
            <th>Désignation</th>
            <th>Quantite</th>
            <th>P.U HT</th>
            <th>Total HT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="5" class="cell-empty">Aucun article ajoute a cette facture.</td>
          </tr>
        </tbody>
      </table>
    `.trim();
  }

  const rows = sale.items
    .map((item) => {
      const descriptionParts: string[] = [`<div class="item-name">${escapeHtml(item.designation)}</div>`];
      descriptionParts.push(`<div class="item-meta">${escapeHtml(displayTypeLabel(item.productType))}</div>`);

      if (isReactiveType(item.productType)) {
        const period = formatReactivePeriod(item);
        if (period) {
          descriptionParts.push(`<div class="item-meta">${escapeHtml(period)}</div>`);
        }
      }

      const quantityLabel = isReactiveType(item.productType) ? "-" : formatQuantity(item.quantity);

      return `
        <tr>
          <td class="cell-center">${escapeHtml(item.productCode || "-")}</td>
          <td>${descriptionParts.join("")}</td>
          <td class="cell-center">${quantityLabel}</td>
          <td class="cell-center">${formatNumber(item.unitPrice)}</td>
          <td class="cell-center">${formatNumber(item.total)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th>Code produit</th>
          <th>Désignation</th>
          <th>Quantite</th>
          <th>P.U HT</th>
          <th>Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `.trim();
};

const UNITS = [
  "zero",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

const tensWord = (tens: number) =>
  [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ][tens];

const convertBelowHundred = (value: number): string => {
  if (value < 17) {
    return UNITS[value];
  }
  if (value < 20) {
    return `dix-${UNITS[value - 10]}`;
  }
  if (value < 70) {
    const tens = Math.floor(value / 10);
    const units = value % 10;
    const tensLabel = tensWord(tens);
    if (units === 0) {
      return tens === 8 ? `${tensLabel}s` : tensLabel;
    }
    if (units === 1 && tens !== 8) {
      return `${tensLabel} et un`;
    }
    return `${tensLabel}-${UNITS[units]}`;
  }
  if (value < 80) {
    return `soixante-${convertBelowHundred(value - 60)}`;
  }
  if (value === 80) {
    return "quatre-vingts";
  }
  return `quatre-vingt-${convertBelowHundred(value - 80)}`;
};

const convertBelowThousand = (value: number): string => {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds === 0) {
    return convertBelowHundred(remainder);
  }

  const hundredsLabel =
    hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${remainder === 0 ? "s" : ""}`;

  if (remainder === 0) {
    return hundredsLabel;
  }

  return `${hundredsLabel} ${convertBelowHundred(remainder)}`;
};

const convertNumberToFrenchWords = (value: number): string => {
  if (value === 0) {
    return UNITS[0];
  }

  const parts: string[] = [];

  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const units = value % 1_000;

  if (millions > 0) {
    parts.push(
      `${millions === 1 ? "un" : convertBelowThousand(millions)} million${millions > 1 ? "s" : ""}`
    );
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push("mille");
    } else {
      parts.push(`${convertBelowThousand(thousands)} mille`);
    }
  }

  if (units > 0) {
    parts.push(convertBelowThousand(units));
  }

  return parts.join(" ");
};

const amountInWords = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  const integerPart = Math.floor(rounded);
  const cents = Math.round((rounded - integerPart) * 100);

  const integerWords = convertNumberToFrenchWords(integerPart);
  const dirhamsLabel = integerPart > 1 ? "dirhams" : "dirham";

  if (cents === 0) {
    return `${integerWords} ${dirhamsLabel}`;
  }

  const centWords = convertNumberToFrenchWords(cents);
  const centsLabel = cents > 1 ? "centimes" : "centime";
  return `${integerWords} ${dirhamsLabel} et ${centWords} ${centsLabel}`;
};

type BuildInvoiceOptions = {
  appendContent?: string;
};

export const buildInvoiceHtml = (sale: Sale, client: Client, options: BuildInvoiceOptions = {}) => {
  const invoiceNumberDisplay = formatInvoiceNumberDisplay(sale.invoiceNumber);

  const replacements: Record<string, string> = {
    "{{HEADER_IMAGE}}": escapeHtml(resolveAssetUrl(headerImageUrl)),
    "{{FOOTER_IMAGE}}": escapeHtml(resolveAssetUrl(footerImageUrl)),
    "{{INVOICE_NUMBER}}": escapeHtml(invoiceNumberDisplay),
    "{{INVOICE_DATE}}": escapeHtml(formatDate(sale.date)),
    "{{CLIENT_NAME}}": escapeHtml(client.name),
    "{{CLIENT_ADDRESS}}": escapeHtml(client.address || "Adresse non communiquee"),
    "{{CLIENT_ICE}}": escapeHtml(client.ice || "Non communique"),
    "{{CLIENT_PHONE}}": escapeHtml(client.phone || "Non communique"),
    "{{CLIENT_EMAIL}}": escapeHtml(client.email || "Non communique"),
    "{{ITEM_TABLE}}": buildItemsTable(sale),
    "{{TOTAL_HT}}": escapeHtml(formatCurrency(sale.totalHT)),
    "{{TOTAL_TVA}}": escapeHtml(formatCurrency(sale.tva)),
    "{{TOTAL_TTC}}": escapeHtml(formatCurrency(sale.totalTTC)),
    "{{AMOUNT_IN_WORDS}}": escapeHtml(amountInWords(sale.totalTTC)),
    "{{COMPANY_ADDRESS}}": escapeHtml(COMPANY_INFO.address),
    "{{COMPANY_EMAIL}}": escapeHtml(COMPANY_INFO.email),
  };

  let html = rawTemplate;

  for (const [token, value] of Object.entries(replacements)) {
    const pattern = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    html = html.replace(pattern, value);
  }

  if (options.appendContent) {
    html = html.replace("</body>", `${options.appendContent}\n</body>`);
  }

  return html;
};

