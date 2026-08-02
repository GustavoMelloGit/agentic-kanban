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

// The column-specific half of a chat prompt. Everything a chat turn shares
// (card, transcript, git isolation) is assembled by buildChatPrompt.
export interface ChatPrompt {
  // tone and limits of the conversation, repeated in every turn
  briefing: string;
  // the agent's first turn, when the thread is still empty. Absent in columns
  // where the human always speaks first.
  opening?: string;
  // what to do after reading the transcript, in every later turn
  continuation: string;
  // how the agent's own turns are labelled in the transcript. "You" only fits a
  // column that owns the whole thread; the default neutral label is what a
  // column reading turns written in *other* columns needs.
  agentLabel?: string;
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
  // In an "autonomous"/"automated" column the agent opens it on arrival; in a
  // "manual" one the human speaks first. Either way, replies drive more turns.
  chat?: boolean;
  chatPrompt?: ChatPrompt;
  // verdict columns end their run with "VERDICT: APPROVE | CHANGES_REQUESTED".
  // On CHANGES_REQUESTED the card goes to onReject instead of onComplete.
  // In a chat column the marker only counts on the last line of a turn.
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

// The chat is re-spawned every turn (no native session), so a column that wants
// the agent to know the code has to say it in every turn.
const WORKSPACE_EXPLORATION_DIRECTIVE =
  "You are running inside this project's workspace: the current working directory IS the project. " +
  "Before restating the goal or asking anything, explore the workspace to understand it for real — this is read-only, do NOT modify anything. " +
  "Read the README and any documentation, the dependency manifest (package.json or its equivalent), the folder structure, and the modules relevant to what this card asks for. " +
  "Ground your restatement and every question in what you actually find in the code — the real stack, conventions, current state, and concrete files — never in generic assumptions.";

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
    chatPrompt: {
      briefing:
        "You are refining a Kanban card through a short back-and-forth with the user. " +
        "Ask focused questions in small batches, progressively filling the gaps. " +
        "Keep replies concise and conversational. Do NOT write code.\n" +
        WORKSPACE_EXPLORATION_DIRECTIVE,
      opening:
        "Explore the workspace first as instructed above, then open the conversation: give a brief, code-grounded read of the idea and your first questions.",
      continuation:
        "Respond to the user's latest message. Ask further questions if gaps remain, or — if the requirements now look complete — summarize the finalized requirements and acceptance criteria and say they're ready for development.",
      // O refinamento é a primeira coluna do thread: tudo que está lá é turno seu.
      agentLabel: "You",
    },
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
    // manual + chat: nothing runs on arrival, the human opens the conversation.
    // The only move the agent can make from here is back to Development.
    chat: true,
    verdict: true,
    onReject: "development",
    worktree: true,
    persona: "a senior engineer walking a human reviewer through the change already on this card's branch",
    // Sem run one-shot: aqui quem fala primeiro é o humano, então todo o trabalho
    // da coluna é descrito no chatPrompt, que se repete a cada turno.
    instruction: "",
    chatPrompt: {
      briefing:
        "You are answering a human who is reviewing this card's change before approving it. " +
        "The change is implemented and pushed: read the diff of the branch against the base (both named in the Git isolation section) plus anything still uncommitted, and ground every answer in it — cite the concrete files and lines you read on the branch, never the base version. " +
        "If there is no Git isolation section, this card never went through Development: say there is no branch to review instead of guessing what changed.\n" +
        "Do NOT write, edit or commit code — this column reviews, it does not implement. " +
        "Keep replies short and concrete — they are reading a diff, not a report. " +
        "Answering a question is a complete turn: the card only leaves this column when the human's change request is settled. " +
        "Approving is the human's move, never yours.",
      continuation:
        "Earlier turns in the transcript may have been written by agents of other columns of this board, not by you — only the human's latest message is the request you are answering now. " +
        "If it is a question, answer it and stop. " +
        "If it is a change request, make sure you understand exactly what must change — ask when it is vague — and only then write the request as the developer agent must receive it (what to change, in which files, and why), and close the turn with a final line that is exactly `VERDICT: CHANGES_REQUESTED`. " +
        "That line sends the card back to Development, so never write it while anything is still being discussed, and never write it just to acknowledge a question.",
    },
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
