import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { listOrders } from "@/lib/db";
import CtvOrdersList from "@/components/ctv/CtvOrdersList";

export const dynamic = "force-dynamic";

export default async function CtvCreateOrderPage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const { orders } = await listOrders({
    search: "",
    limit: 200,
    offset: 0,
    ctvId: session.ctvId,
  });

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tạo đơn</h1>
      <p className="mt-1 text-sm text-ink/55">Tạo đơn hàng gửi về kho Falco và theo dõi trạng thái duyệt</p>

      <div className="mt-6">
        <CtvOrdersList initialOrders={orders} />
      </div>
    </div>
  );
}
