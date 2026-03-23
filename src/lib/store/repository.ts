import type { QrRepository } from "@/lib/store/types";

let repositoryPromise: Promise<QrRepository> | null = null;

async function loadRepository() {
  if (process.env.DATABASE_URL?.trim()) {
    const { prismaRepository } = await import("@/lib/store/prisma-store");
    return prismaRepository;
  }

  const { fileRepository } = await import("@/lib/store/file-store");
  return fileRepository;
}

export async function getQrRepository() {
  if (!repositoryPromise) {
    repositoryPromise = loadRepository();
  }

  return repositoryPromise;
}
