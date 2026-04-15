export interface ThreadMetadata {
  id: string;
  title: string;
  parentId: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
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

export interface AppState {
  activeProjectId: string | null;
  activeThreadId: string | null;
  author: string;
  version: number;
}

export interface TreeNode {
  parentId: string | null;
  children: string[];
}

export interface TreeStructure {
  nodes: Record<string, TreeNode>;
}

export interface Services {
  storage: StorageService;
  project: ProjectService;
  thread: ThreadService;
  context: ContextService;
}

// Service interfaces for dependency injection
export interface StorageService {
  ensureInitialized(): Promise<void>;
  readConfig(): Promise<AppState>;
  writeConfig(state: AppState): Promise<void>;
  readProjectConfig(projectId: string): Promise<ProjectConfig>;
  writeProjectConfig(config: ProjectConfig): Promise<void>;
  listProjects(): Promise<ProjectConfig[]>;
  readThread(projectId: string, threadId: string): Promise<ThreadNode>;
  writeThread(projectId: string, node: ThreadNode): Promise<void>;
  deleteThread(projectId: string, threadId: string): Promise<void>;
  threadExists(projectId: string, threadId: string): Promise<boolean>;
  readTree(projectId: string): Promise<TreeStructure>;
  writeTree(projectId: string, tree: TreeStructure): Promise<void>;
  deleteProjectDir(projectId: string): Promise<void>;
}

export interface ProjectService {
  create(opts: {
    title: string;
    systemContext?: string;
    mode?: "solo" | "team";
  }): Promise<ProjectConfig>;
  list(): Promise<ProjectConfig[]>;
  switch(projectId: string): Promise<void>;
  getActive(): Promise<ProjectConfig | null>;
}

export interface ThreadService {
  create(opts: {
    projectId: string;
    parentId: string;
    title: string;
    author: string;
  }): Promise<ThreadNode>;
  switch(projectId: string, threadId: string): Promise<void>;
  list(projectId: string): Promise<string>;
  get(projectId: string, threadId: string): Promise<ThreadNode>;
  updateSummary(opts: {
    projectId: string;
    threadId: string;
    content: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<void>;
  delete(opts: {
    projectId: string;
    threadId: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<void>;
}

export interface ContextResult {
  text: string;
  tokens: number;
  threadDepth: number;
}

export interface ContextService {
  assemble(projectId: string, threadId: string): Promise<ContextResult>;
}
