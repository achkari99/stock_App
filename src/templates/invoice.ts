import rawTemplate from "./invoice-template.html?raw";
import logoUrl from "@/assets/invoice-logo.png?url";
import { Sale, Client, Depot, SaleItem } from "@/types";

const COMPANY_INFO = {
  address: "Place Souk de 61, Rue Tabari Résidence El Futuro, Tanger",
  email: "contact@laboratoire-kawassim.com",
  bankIce: "001234567890",
  bankIf: "12345678",
  bankTp: "1234567",
  bankRib: "123 456 7890 1234567890123 45",
};

const depotOrder: Depot[] = ["A", "B", "C"];

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

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "MAD",
  minimumFractionDigits: 2,
});

const replaceNarrowSpaces = (input: string) =>
  input.replace(/\u202F/g, " ").replace(/\u00A0/g, " ");

const formatNumber = (value: number) => replaceNarrowSpaces(amountFormatter.format(value));

const formatCurrency = (value: number) => replaceNarrowSpaces(currencyFormatter.format(value));

const formatQuantity = (value: number) => (Number.isInteger(value) ? `${value}` : formatNumber(value));

const resolveAssetUrl = (assetPath: string) => {
  if (/^(data:|https?:)/i.test(assetPath)) {
    return assetPath;
  }
  return new URL(assetPath, window.location.origin).toString();
};

const formatDistribution = (item: SaleItem, defaultDepot: Depot) => {
  const distribution: Partial<Record<Depot, number>> =
    item.quantityPerDepot ??
    ({
      [defaultDepot]: item.quantity,
    } as Partial<Record<Depot, number>>);

  const chunks = depotOrder
    .map((depot) => {
      const qty = distribution[depot] ?? 0;
      return qty > 0 ? `${depot} : ${formatQuantity(qty)}` : null;
    })
    .filter(Boolean);

  return chunks.length > 0 ? chunks.join(" | ") : "-";
};

const buildItemRows = (sale: Sale) => {
  if (sale.items.length === 0) {
    return `<tr><td colspan="4" style="padding:18px; text-align:center; color:#802742;">Aucun article ajouté à cette facture.</td></tr>`;
  }

  return sale.items
    .map((item) => {
      const distribution = formatDistribution(item, sale.depot);

      return `
        <tr>
          <td>
            <div class="designation">${escapeHtml(item.designation)}</div>
          </td>
          <td class="cell-center">${formatQuantity(item.quantity)}</td>
          <td class="cell-right">${formatNumber(item.unitPrice)}</td>
          <td class="cell-right">${formatNumber(item.total)}</td>
        </tr>
      `;
    })
    .join("")
    .trim();
};

const UNITS = [
  "zéro",
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
  ][tens] ?? "";

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

export const buildInvoiceHtml = (sale: Sale, client: Client) => {
  const replacements: Record<string, string> = {
    "{{LOGO_DATA}}": escapeHtml(resolveAssetUrl(logoUrl)),
    "{{INVOICE_NUMBER}}": escapeHtml(sale.invoiceNumber),
    "{{INVOICE_DATE}}": escapeHtml(formatDate(sale.date)),
    "{{CLIENT_NAME}}": escapeHtml(client.name),
    "{{CLIENT_ADDRESS}}": escapeHtml(client.address || "Adresse non communiquée"),
    "{{CLIENT_ICE}}": escapeHtml(client.ice || "Non communiqué"),
    "{{CLIENT_PHONE}}": escapeHtml(client.phone || "Non communiqué"),
    "{{CLIENT_EMAIL}}": escapeHtml(client.email || "Non communiqué"),
    "{{BANK_ICE}}": escapeHtml(COMPANY_INFO.bankIce),
    "{{BANK_IF}}": escapeHtml(COMPANY_INFO.bankIf),
    "{{BANK_TP}}": escapeHtml(COMPANY_INFO.bankTp),
    "{{BANK_RIB}}": escapeHtml(COMPANY_INFO.bankRib),
    "{{ITEM_ROWS}}": buildItemRows(sale),
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

  return html;
};
