// One-off: send a test email and a real receipt (PDF attached) to EMAIL_USER.
import "reflect-metadata";
import { env } from "../config/env";
import { AppDataSource } from "../infrastructure/database/dataSource";
import { ReceiptService } from "../modules/sale/services/receipt.service";
import { receiptEmail } from "../shared/utils/mail/customer.mail";
import { emailConfigured, emailLayout, heading, paragraph, sendMail } from "../shared/utils/mailer";

async function main(): Promise<void> {
  const to = env.email.user;
  console.log(`provider: ${env.email.provider}, configured: ${emailConfigured()}, sending to: ${to.replace(/^(.{3}).*(@.*)$/, "$1…$2")}`);
  await AppDataSource.initialize();
  try {
    const brand = { businessName: "Lekki Home & Electronics", footerEmail: "hello@lekkihome.ng" };
    const ok1 = await sendMail({
      to,
      fromName: brand.businessName,
      subject: "Test email — Lekki Home & Electronics",
      html: emailLayout(heading("Email is working") + paragraph("This test was sent from ShowroomPro using Gmail."), brand),
      text: "Email is working. This test was sent from ShowroomPro.",
    });
    console.log(`1) test email: ${ok1 ? "sent" : "FAILED"}`);

    const rows: Array<{ id: string; organizationId: string }> = await AppDataSource.query(
      `SELECT id, organization_id AS "organizationId" FROM sales WHERE status = 'completed' AND customer_id IS NOT NULL ORDER BY total DESC LIMIT 1`
    );
    const receipt = await ReceiptService.Instance.forEmail(rows[0].organizationId, rows[0].id);
    if (!receipt) throw new Error("no sale found");
    const mail = receiptEmail({
      brand,
      currencySymbol: "₦",
      customerName: receipt.sale.customerName ?? "Customer",
      code: receipt.sale.code,
      date: new Date(receipt.sale.soldAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }),
      items: receipt.items.map((i) => ({ name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName, quantity: i.quantity, lineTotal: i.lineTotal })),
      total: receipt.sale.total,
      amountPaid: receipt.sale.amountPaid,
      balanceDue: receipt.sale.balanceDue,
      dueDate: receipt.sale.dueDate,
      receiptUrl: receipt.receiptUrl,
    });
    const ok2 = await sendMail({ to, fromName: brand.businessName, ...mail, attachments: [{ filename: `receipt-${receipt.sale.code}.pdf`, contentType: "application/pdf", content: receipt.pdf }] });
    console.log(`2) receipt ${receipt.sale.code} with PDF (${Math.round(receipt.pdf.length / 1024)} KB): ${ok2 ? "sent" : "FAILED"}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
