import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { listAiIntakeImagesByOrder } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const images = await listAiIntakeImagesByOrder(Number(id));
  return NextResponse.json({ images });
}
