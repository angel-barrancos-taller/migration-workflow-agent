import type { Actor } from "xstate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MigrationActor = Actor<any>;

interface Job {
  actor: MigrationActor;
  createdAt: number;
}

const JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Hang off globalThis so Next.js HMR module re-evaluation doesn't wipe the store
const globalStore = globalThis as typeof globalThis & {
  __migrationJobs?: Map<string, Job>;
};

function getStore(): Map<string, Job> {
  if (!globalStore.__migrationJobs) {
    globalStore.__migrationJobs = new Map();
  }
  return globalStore.__migrationJobs;
}

export function setJob(jobId: string, actor: MigrationActor): void {
  getStore().set(jobId, { actor, createdAt: Date.now() });
  sweepExpired();
}

export function getJob(jobId: string): MigrationActor | undefined {
  const job = getStore().get(jobId);
  if (!job) return undefined;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    getStore().delete(jobId);
    return undefined;
  }
  return job.actor;
}

export function deleteJob(jobId: string): void {
  getStore().delete(jobId);
}

function sweepExpired(): void {
  const store = getStore();
  const now = Date.now();
  for (const [id, job] of store) {
    if (now - job.createdAt > JOB_TTL_MS) {
      store.delete(id);
    }
  }
}

export function jobCount(): number {
  return getStore().size;
}

// For tests only
export function clearJobs(): void {
  getStore().clear();
}
