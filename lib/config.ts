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
  // worktree columns run their agent inside the card's own git worktree and
  // branch, created by the engine before the spawn (see lib/worktree.ts).
  worktree?: boolean;
  // arriving here means the card's work is over: the worktree is removed.
  dropWorktree?: boolean;
  // arriving here requires an open PR for the card's branch; the engine checks
  // and records the URL — or the warning — in the card's history.
  requiresPr?: boolean;
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
      "This card is an early idea and is under-specified. Identify the gaps. Produce: (1) a crisp restatement of the goal, and (2) the 3-6 most important open questions you need answered before development. Anchor both the restatement and the questions in the concrete files and modules you found in the code. Do NOT write code.",
  },
  {
    id: "development",
    name: "Development",
    type: "autonomous",
    onComplete: "ai-review",
    worktree: true,
    persona: "a senior software engineer",
    instruction:
      "Implement this card in the current workspace. Make the necessary code changes directly. Keep the change focused and consistent with the surrounding code.\n" +
      "When the implementation is done: commit everything, push the branch with `git push -u origin <branch>`, and open a pull request to the base branch with `gh pr create` — if a PR is already open for this branch, pushing is enough, but update its body if the decisions changed. If `gh` is unavailable or unauthenticated, push the branch anyway and say so in your output.\n" +
      "The PR body is at most FIVE one-line bullets, and covers ONLY the decisions that led to this solution — the trade-offs a reviewer could not guess from the diff. No file-by-file changelog, no test plan, no restated card text, no generated footer. A long body is a bad body: it will not be read.\n" +
      "Finally, output a short summary of what you changed, the PR URL, and any follow-ups.",
  },
  {
    id: "ai-review",
    name: "AI Review",
    type: "autonomous",
    onComplete: "human-review",
    verdict: true,
    onReject: "development",
    worktree: true,
    persona: "a meticulous code reviewer",
    instruction:
      "Review this card's changes: the diff of its branch against the base branch (both named in the Git isolation section) plus anything still uncommitted. Check correctness, edge cases, and consistency.\n" +
      "The FIRST line of your output must be exactly `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` (nothing else on that line). " +
      "Then a concise bullet list of findings. On CHANGES_REQUESTED, each bullet must be actionable — the developer agent gets this text as its only feedback.",
  },
  {
    id: "human-review",
    name: "Human Review",
    type: "manual",
    onComplete: null,
    requiresPr: true,
    persona: "",
    instruction: "",
  },
  {
    id: "done",
    name: "Done",
    type: "manual",
    onComplete: null,
    dropWorktree: true,
    persona: "",
    instruction: "",
  },
];

// Quantas devoluções uma coluna de veredito pode fazer antes de desistir e
// parar o card em onComplete pra decisão humana.
export const MAX_REVIEW_CYCLES = 3;

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
