import { notFound } from "next/navigation";
import { findKangoBillById, type KangoInvoiceItem, type KangoPackage } from "@/lib/db";
import KangoBillForm, { type KangoBillInitial } from "@/components/admin/KangoBillForm";
import KangoBillSendBar from "@/components/admin/KangoBillSendBar";

export const dynamic = "force-dynamic";

export default async function KangoBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await findKangoBillById(Number(id));
  if (!bill) notFound();

  const packages = (JSON.parse(bill.packages_json) as KangoPackage[]).map((p) => ({
    packageQuantity: String(p.packageQuantity),
    packageType: p.packageType,
    packageLength: String(p.packageLength),
    packageWidth: String(p.packageWidth),
    packageHeight: String(p.packageHeight),
    packageWeight: String(p.packageWeight),
  }));
  const invoices = bill.invoices_json
    ? (JSON.parse(bill.invoices_json) as KangoInvoiceItem[]).map((i) => ({
        invoiceGoodsDetails: i.invoiceGoodsDetails,
        invoiceQuantity: String(i.invoiceQuantity),
        invoiceUnit: i.invoiceUnit,
        invoicePrice: String(i.invoicePrice),
        invoiceTotalPrice: String(i.invoiceTotalPrice),
      }))
    : [];

  const initial: KangoBillInitial = {
    id: bill.id,
    receiverCompanyName: bill.receiver_company_name,
    receiverContactName: bill.receiver_contact_name,
    receiverTelephone: bill.receiver_telephone,
    receiverCountry: bill.receiver_country,
    receiverStateName: bill.receiver_state_name,
    receiverCity: bill.receiver_city,
    receiverPostalCode: bill.receiver_postal_code,
    receiverAddress1: bill.receiver_address_1,
    receiverAddress2: bill.receiver_address_2 ?? "",
    receiverAddress3: bill.receiver_address_3 ?? "",
    shipmentService: bill.shipment_service,
    shipmentSignatureFlg: Boolean(bill.shipment_signature_flg),
    shipmentBranch: bill.shipment_branch,
    shipmentReferenceCode: bill.shipment_reference_code ?? "",
    shipmentGoodsName: bill.shipment_goods_name,
    shipmentValue: bill.shipment_value,
    shipmentExportAs: bill.shipment_export_as,
    packages,
    invoices,
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Bill #{bill.id}</h1>
      <p className="mt-1 text-sm text-ink/55">{bill.receiver_contact_name}</p>

      <div className="mt-4">
        <KangoBillSendBar
          billId={bill.id}
          status={bill.status}
          sendError={bill.send_error}
          sent={{
            kango_bill_id: bill.kango_bill_id,
            kango_hawbs_json: bill.kango_hawbs_json,
            kango_redirect_url: bill.kango_redirect_url,
            sent_by: bill.sent_by,
            sent_at: bill.sent_at,
          }}
        />
      </div>

      <div className="mt-6">
        <KangoBillForm initial={initial} />
      </div>
    </div>
  );
}
