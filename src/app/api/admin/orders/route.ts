import { NextResponse } from "next/server";
import { listOrders } from "@/lib/db";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const receivedFrom = ymd(searchParams.get("from"));
  const receivedTo = ymd(searchParams.get("to"));

  const { orders, total } = await listOrders({
    search,
    receivedFrom,
    receivedTo,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return NextResponse.json({
    orders,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
