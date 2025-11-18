import rawTemplate from "./delivery-note-template.html?raw";
import headerImageUrl from "@/assets/invoice_header.jpg?url";
import footerImageUrl from "@/assets/invoice_footer.jpg?url";
import { Sale, Client, SaleItem } from "@/types";
import { isReactiveType } from "@/lib/utils";
import { formatInvoiceNumberDisplay } from "./invoice";

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
  return `P&eacute;riode : ${start.toLocaleDateString("fr-FR")} au ${end.toLocaleDateString("fr-FR")}`;
};

const formatDeliveryNumber = (invoiceNumber: string) => `BL-${formatInvoiceNumberDisplay(invoiceNumber)}`;

const buildItemRows = (sale: Sale) => {
  if (sale.items.length === 0) {
    return `
      <tr>
        <td colspan="3" class="cell-empty">Aucun article ajoute a ce bon de livraison.</td>
      </tr>
    `.trim();
  }

  return sale.items
    .map((item) => {
      const reference = item.productCode ? escapeHtml(item.productCode) : "-";
      const quantity = isReactiveType(item.productType) ? "-" : formatQuantity(item.quantity);
      const descriptionParts: string[] = [
        `<div class="item-name">${escapeHtml(item.designation)}</div>`,
        `<div class="item-meta">Type : ${escapeHtml(item.productType)}</div>`,
      ];

      if (isReactiveType(item.productType)) {
        const period = formatReactivePeriod(item);
        if (period) {
          descriptionParts.push(`<div class="item-meta">${period}</div>`);
        }
      }

      return `
        <tr>
          <td class="cell-center">${reference}</td>
          <td>${descriptionParts.join("")}</td>
          <td class="cell-center">${quantity}</td>
        </tr>
      `;
    })
    .join("");
};

export const buildDeliveryNoteHtml = (sale: Sale, client: Client) => {
  const resolvedClientCode = client.code && client.code.trim().length > 0 ? client.code : undefined;

  const replacements: Record<string, string> = {
    "{{HEADER_IMAGE}}": escapeHtml(resolveAssetUrl(headerImageUrl)),
    "{{FOOTER_IMAGE}}": escapeHtml(resolveAssetUrl(footerImageUrl)),
    "{{DELIVERY_NUMBER}}": escapeHtml(formatDeliveryNumber(sale.invoiceNumber)),
    "{{DELIVERY_DATE}}": escapeHtml(formatDate(sale.date)),
    "{{REFERENCE_INVOICE}}": escapeHtml(formatInvoiceNumberDisplay(sale.invoiceNumber)),
    "{{CLIENT_CODE}}": escapeHtml(resolvedClientCode || client.ice || client.id || sale.clientId),
    "{{CLIENT_NAME}}": escapeHtml(client.name),
    "{{CLIENT_ADDRESS}}": escapeHtml(client.address || "Adresse non communiquee"),
    "{{CLIENT_ICE}}": escapeHtml(client.ice || "Non communique"),
    "{{CLIENT_PHONE}}": escapeHtml(client.phone || "Non communique"),
    "{{ITEM_ROWS}}": buildItemRows(sale),
  };

  let html = rawTemplate;

  for (const [token, value] of Object.entries(replacements)) {
    const pattern = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    html = html.replace(pattern, value);
  }

  return html;
};
