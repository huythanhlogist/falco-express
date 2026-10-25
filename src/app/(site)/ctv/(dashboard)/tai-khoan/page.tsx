import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findCtvById } from "@/lib/db";
import CtvProfileForm from "@/components/ctv/CtvProfileForm";

export const dynamic = "force-dynamic";

export default async function CtvAccountPage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const ctv = await findCtvById(session.ctvId);
  if (!ctv) redirect("/ctv/login");

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tài khoản</h1>
      <p className="mt-1 text-sm text-ink/55">Thông tin cá nhân và liên hệ hiển thị trên bảng giá gửi khách</p>

      <div className="mt-6">
        <CtvProfileForm profile={ctv} />
      </div>
    </div>
  );
}
