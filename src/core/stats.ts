import type {
  StorageService,
  StatsService,
  ProjectStats,
} from "../types/index.js";

export class StatsServiceImpl implements StatsService {
  constructor(private storage: StorageService) {}

  async recordUpdate(
    projectId: string,
    threadId: string,
    newContent: string
  ): Promise<void> {
    const stats = await this.storage.readProjectStats(projectId);
    const existing = stats.threads[threadId];

    if (existing) {
      existing.updateCount += 1;
      existing.currentContentLength = newContent.length;
      existing.cumulativeInputLength += newContent.length;
      existing.lastUpdatedAt = new Date().toISOString();
    } else {
      stats.threads[threadId] = {
        updateCount: 1,
        firstContentLength: newContent.length,
        currentContentLength: newContent.length,
        cumulativeInputLength: newContent.length,
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    await this.storage.writeProjectStats(projectId, stats);
  }

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    return this.storage.readProjectStats(projectId);
  }
}
