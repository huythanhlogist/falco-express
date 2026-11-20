import { notFound } from "next/navigation";
import { findKangoBillById, listKangoBillImages, type KangoInvoiceItem, type KangoPackage } from "@/lib/db";
import KangoBillForm, { type KangoBillInitial } from "@/components/admin/KangoBillForm";
import KangoBillImages from "@/components/admin/KangoBillImages";
import KangoBillSendBar from "@/components/admin/KangoBillSendBar";
import { ImageDownloadIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function KangoBillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imageUploadError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const bill = await findKangoBillById(Number(id));
  if (!bill) notFound();

  const imageRows = await listKangoBillImages(bill.id);
  const initialImages = imageRows.map((img) => ({
    id: img.id,
    filename: img.filename,
    mime_type: img.mime_type,
    url: `/api/admin/kango-bills/images/${img.id}`,
  }));

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
    customerNote: bill.customer_note ?? "",
    packages,
    invoices,
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">Bill #{bill.id}</h1>
          <p className="mt-1 text-sm text-ink/55">{bill.receiver_contact_name}</p>
        </div>
        <a
          href={`/api/admin/kango-bills/${bill.id}/face`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex items-center gap-1.5 !px-4 !py-2 text-sm"
        >
          <ImageDownloadIcon className="h-4 w-4" />
          <span>Xem ảnh mặt bill</span>
        </a>
      </div>

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

      {bill.customer_note?.trim() && (
        <section className="mt-6 rounded-xl border border-line bg-white p-4">
          <p className="font-display text-sm font-bold text-navy-900">Ghi chú cho khách</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-normal text-ink">{bill.customer_note}</p>
        </section>
      )}

      <div className="mt-6">
        <KangoBillImages
          billId={bill.id}
          initialImages={initialImages}
          initialWarning={query.imageUploadError}
        />
      </div>

      <div className="mt-6">
        <KangoBillForm initial={initial} />
      </div>
    </div>
  );
}
