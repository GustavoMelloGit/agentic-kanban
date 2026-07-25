// Domain types + static configuration (tools & columns).
// Projects and cards live in SQLite (see lib/schema.ts); the values here are
// only the initial seed used when the database is empty.

// --- Types -----------------------------------------------------------------
export type ColumnType = "autonomous" | "automated" | "manual";

export interface Tool {
  label: string;
  command: string;
  args: string[]; // "{{prompt}}" is replaced with the built prompt at spawn time
}

export interface Column {
  id: string;
  name: string;
  // type decides BOTH whether an agent runs on arrival AND whether the card moves:
  //   "autonomous" -> agent runs on arrival, then moves to onComplete when done
  //   "automated"  -> agent runs on arrival, but the card stays put
  //   "manual"     -> no agent, no auto-move (moved only by the human)
  type: ColumnType;
  onComplete: string | null; // target column for "autonomous" columns
  persona: string;
  instruction: string;
  // chat columns hold a back-and-forth conversation instead of a one-shot run.
  // On arrival the agent opens the conversation; the user replies drive more turns.
  chat?: boolean;
  // verdict columns end their run with "VERDICT: APPROVE | CHANGES_REQUESTED".
  // On CHANGES_REQUESTED the card goes to onReject instead of onComplete.
  verdict?: boolean;
  onReject?: string | null;
}

export interface Project {
  id: string;
  name: string;
  tool: string; // key into TOOLS
  workspace: string; // relative to app root, or absolute
}

export type CardStatus = "idle" | "running" | "error";

export interface RunEntry {
  column: string;
  tool?: string;
  ok?: boolean;
  output: string;
  at: string;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  at: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  projectId: string;
  columnId: string;
  status: CardStatus;
  // how many times a verdict column bounced this card back (loop guard)
  reviewCycles: number;
  history: RunEntry[];
  messages: ChatMessage[];
  createdAt: string;
}

export interface Board {
  tools: Record<string, Tool>;
  columns: Column[];
  projects: Project[];
  cards: Card[];
}

// --- Tools (the tool-agnostic runner layer) --------------------------------
export const TOOLS: Record<string, Tool> = {
  claude: {
    label: "Claude Code",
    command: "claude",
    args: ["-p", "{{prompt}}", "--dangerously-skip-permissions"],
  },
  cursor: {
    label: "Cursor Agent",
    command: "cursor-agent",
    args: ["-p", "{{prompt}}", "--force"],
  },
};

// --- Columns ---------------------------------------------------------------
export const COLUMNS: Column[] = [
  { id: "ideas", name: "Ideas", type: "manual", onComplete: null, persona: "", instruction: "" },
  {
    id: "enrichment",
    name: "Enrichment",
    type: "automated",
    chat: true,
    onComplete: null,
    persona:
      "a sharp product analyst who turns half-baked ideas into clear, buildable requirements",
    instruction:
      "This card is an early idea and is under-specified. Identify the gaps. Produce: (1) a crisp restatement of the goal, and (2) the 3-6 most important open questions you need answered before development. Do NOT write code.",
  },
  {
    id: "development",
    name: "Development",
    type: "autonomous",
    onComplete: "ai-review",
    persona: "a senior software engineer",
    instruction:
      "Implement this card in the current workspace. Make the necessary code changes directly. Keep the change focused and consistent with the surrounding code. When done, output a short summary of what you changed and any follow-ups.",
  },
  {
    id: "ai-review",
    name: "AI Review",
    type: "autonomous",
    onComplete: "human-review",
    verdict: true,
    onReject: "development",
    persona: "a meticulous code reviewer",
    instruction:
      "Review the most recent changes in this workspace (use git to inspect the diff). Check correctness, edge cases, and consistency.\n" +
      "The FIRST line of your output must be exactly `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` (nothing else on that line). " +
      "Then a concise bullet list of findings. On CHANGES_REQUESTED, each bullet must be actionable — the developer agent gets this text as its only feedback.",
  },
  { id: "human-review", name: "Human Review", type: "manual", onComplete: null, persona: "", instruction: "" },
  { id: "done", name: "Done", type: "manual", onComplete: null, persona: "", instruction: "" },
];

// --- Verdicts --------------------------------------------------------------

// How many times a verdict column may bounce a card back before it gives up
// and parks the card in onComplete for a human to look at.
export const MAX_REVIEW_CYCLES = 3;

export type Verdict = "APPROVE" | "CHANGES_REQUESTED";

// Read the verdict out of an agent's output. Returns null when the agent didn't
// follow the format — callers treat that as "don't route, let a human decide".
export function parseVerdict(output: string): Verdict | null {
  // Preferred shape: a "VERDICT: X" line (tolerating markdown noise around it).
  const tagged = output.match(/^\W*VERDICT\W+(APPROVE|CHANGES_REQUESTED)\b/im);
  if (tagged) return tagged[1].toUpperCase() as Verdict;

  // Fallback for agents that drop the prefix: accept the first non-empty line
  // only when it is *nothing but* the verdict. Prose that merely mentions a
  // verdict stays unparsed — the instruction itself names both words, so a
  // loose match would happily read an echo of it as a real verdict.
  const first = output.split("\n").find((l) => l.trim()) ?? "";
  const bare = first.trim().match(/^\W*(APPROVED?|CHANGES_REQUESTED)\W*$/i);
  if (bare) return /^C/i.test(bare[1]) ? "CHANGES_REQUESTED" : "APPROVE";
  return null;
}

// --- Seed data (only used when the DB is empty) ----------------------------
export const SEED_PROJECTS: Project[] = [
  { id: "demo", name: "Demo Project", tool: "claude", workspace: "workspaces/demo" },
];

export const SEED_CARDS: Omit<Card, "history" | "messages">[] = [
  {
    id: "card-1",
    title: "Add a /health endpoint",
    description:
      "Add a simple GET /health endpoint to server.js that returns { status: 'ok' } as JSON.",
    projectId: "demo",
    columnId: "ideas",
    status: "idle",
    reviewCycles: 0,
    createdAt: "seed",
  },
];
