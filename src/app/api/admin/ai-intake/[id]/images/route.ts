import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { listAiIntakeImagesByOrder } from "@/lib/db";

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const images = await listAiIntakeImagesByOrder(Number(id));
  return NextResponse.json({ images });
}
