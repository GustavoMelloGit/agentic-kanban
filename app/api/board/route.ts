import { getBoard } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getBoard());
}
