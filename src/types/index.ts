export type ThreadStatus = "active" | "done" | "abandoned";

export interface ThreadMetadata {
  id: string;
  title: string;
  parentId: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
  /** Absent means active */
  status?: ThreadStatus;
  /** Git branch the thread is linked to */
  branch?: string;
  /** HEAD commit when the summary was last written */
  commit?: string;
  /** Files or directories the summary covers, to detect outdated summaries */
  paths?: string[];
  /** Parent thread the thread was merged into */
  mergedInto?: string;
}

export interface ThreadNode {
  metadata: ThreadMetadata;
  content: string;
}

export interface ProjectConfig {
  id: string;
  title: string;
  systemContext: string;
  mode: "solo" | "team";
  rootThreadId: string;
}

/** A Claude Code session measured by the plugin hooks */
export interface SessionMeasurement {
  sessionId: string;
  projectId?: string;
  startedAt?: string;
  /** How the session started: startup, clear or compact */
  source?: string;
  /** Estimated size of the ThreadMind context injected at start */
  injectedTokens?: number;
  endedAt?: string;
  endReason?: string;
  /** Size of the conversation when the session ended, read from its transcript */
  finalContextTokens?: number;
}

export interface AppState {
  /** Last project used, the default for new sessions */
  activeProjectId: string | null;
  /** Last thread used, the default for new sessions outside git */
  activeThreadId: string | null;
  author: string;
  version: number;
  /** Last thread used on each git branch, per project */
  branchThreads?: Record<string, Record<string, string>>;
  /** Most recent sessions measured by the Claude Code plugin */
  sessions?: SessionMeasurement[];
}

export interface TreeNode {
  parentId: string | null;
  children: string[];
}

export interface TreeStructure {
  nodes: Record<string, TreeNode>;
}

export type SummarySection =
  | "decisions"
  | "constraints"
  | "state"
  | "open-questions"
  | "next-steps";

export interface ActiveThread {
  projectId: string;
  threadId: string;
  /** Checked-out git branch, or null outside git */
  branch: string | null;
  /** Why this thread is active */
  reason: "session" | "branch-memory" | "branch" | "last-used" | "default";
}

export interface Services {
  storage: StorageService;
  project: ProjectService;
  thread: ThreadService;
  context: ContextService;
  stats: StatsService;
  session: SessionService;
}

// Service interfaces for dependency injection
export interface StorageService {
  workspaceRoot(): Promise<string>;
  ensureInitialized(): Promise<void>;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
  readConfig(): Promise<AppState>;
  writeConfig(state: AppState): Promise<void>;
  readProjectConfig(projectId: string): Promise<ProjectConfig>;
  writeProjectConfig(config: ProjectConfig): Promise<void>;
  listProjects(): Promise<ProjectConfig[]>;
  readThread(projectId: string, threadId: string): Promise<ThreadNode>;
  writeThread(projectId: string, node: ThreadNode): Promise<void>;
  deleteThread(projectId: string, threadId: string): Promise<void>;
  threadExists(projectId: string, threadId: string): Promise<boolean>;
  /** Every thread of a project, read from the thread files */
  listThreads(projectId: string): Promise<ThreadNode[]>;
  /** Tree derived from the parentId of each thread file */
  readTree(projectId: string): Promise<TreeStructure>;
}

export interface ProjectService {
  create(opts: {
    title: string;
    systemContext?: string;
    mode?: "solo" | "team";
  }): Promise<ProjectConfig>;
  list(): Promise<ProjectConfig[]>;
  get(projectId: string): Promise<ProjectConfig>;
  resolveAuthor(): Promise<string>;
}

export interface ThreadService {
  create(opts: {
    projectId: string;
    parentId: string;
    title: string;
    author: string;
    branch?: string;
  }): Promise<ThreadNode>;
  list(projectId: string, activeThreadId: string | null): Promise<string>;
  get(projectId: string, threadId: string): Promise<ThreadNode>;
  updateSummary(opts: {
    projectId: string;
    threadId: string;
    content: string;
    author: string;
    mode: "solo" | "team";
    section?: SummarySection;
    replaceSection?: boolean;
    commit?: string;
    paths?: string[];
  }): Promise<ThreadNode>;
  setStatus(opts: {
    projectId: string;
    threadId: string;
    status: ThreadStatus;
    reason?: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<ThreadNode>;
  merge(opts: {
    projectId: string;
    threadId: string;
    parentSummary: string;
    author: string;
    mode: "solo" | "team";
    commit?: string;
  }): Promise<{ parentId: string }>;
  /** Returns the IDs of the deleted threads */
  delete(opts: {
    projectId: string;
    threadId: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<string[]>;
  rebase(opts: {
    projectId: string;
    threadId: string;
    newParentId: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<void>;
}

export interface ContextResult {
  text: string;
  tokens: number;
  threadDepth: number;
  /** Ancestors left out to fit the token budget */
  omitted: string[];
  /** Whether the text itself was cut to fit the token budget */
  truncated: boolean;
}

export interface ContextService {
  assemble(
    projectId: string,
    threadId: string,
    opts?: { maxTokens?: number }
  ): Promise<ContextResult>;
}

export interface StatsService {
  recordSessionStart(opts: {
    sessionId: string;
    projectId: string;
    source: string;
    injectedTokens: number;
  }): Promise<void>;
  recordSessionEnd(opts: {
    sessionId: string;
    reason: string;
    finalContextTokens: number | null;
  }): Promise<void>;
  sessions(): Promise<SessionMeasurement[]>;
}

export interface SessionService {
  /** Active project and thread of this session, or null without a project */
  active(): Promise<ActiveThread | null>;
  selectProject(projectId: string): Promise<void>;
  selectThread(projectId: string, threadId: string): Promise<void>;
  /** The branch a new thread should be linked to, if any */
  branchToLink(projectId: string): Promise<string | null>;
}
