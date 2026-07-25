import { createProject, getProjects } from "../../../lib/store";
import { validateProject } from "../../../lib/projects";

export function GET() {
  return Response.json(getProjects());
}

export async function POST(req: Request) {
  const checked = validateProject(await req.json(), false);
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
  const { name, tool, workspace } = checked.fields;
  return Response.json(createProject({ name: name!, tool: tool!, workspace: workspace! }));
}
