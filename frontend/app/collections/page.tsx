"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollectionsBoard } from "@/components/CollectionsBoard";
import { getStoredUser } from "@/lib/session";
import {
  createCollectionFile,
  createCollectionFolder,
  deleteCollectionFile,
  deleteCollectionFolder,
  fetchCollectionTree,
  updateCollectionFile,
  updateCollectionFolder,
  type CollectionFile,
  type CollectionFolder,
} from "@/lib/collectionsApi";

export default function CollectionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [files, setFiles] = useState<CollectionFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async (uid: number) => {
    const tree = await fetchCollectionTree(uid);
    setFolders(tree.folders);
    setFiles(tree.files);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setUserId(user.id);
    loadTree(user.id)
      .catch(() => setError("Could not load collections. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [router, loadTree]);

  if (loading || !userId) {
    return (
      <main className="app-shell flex items-center justify-center text-stone-600">
        Loading…
      </main>
    );
  }

  return (
    <main className="app-shell px-4 py-8 sm:px-6">
      <header className="mx-auto mb-8 grid max-w-4xl grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="hidden sm:block" />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/70">
            KaamKaaj
          </p>
          <h1 className="font-serif text-2xl text-stone-900">Collections</h1>
          <p className="mt-1 text-sm text-stone-600">
            Organize folders and files — links, notes, or anything you want to keep.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="justify-self-center text-sm text-teal-800 hover:underline sm:justify-self-end"
        >
          ← Dashboard
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-4xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
        >
          {error}
        </p>
      ) : null}

      <CollectionsBoard
        ownerUserId={userId}
        folders={folders}
        files={files}
        currentFolderId={currentFolderId}
        onOpenFolder={setCurrentFolderId}
        onAddFolder={async ({ name, color }) => {
          const { folder } = await createCollectionFolder(
            userId,
            name,
            currentFolderId,
            color,
          );
          const inheritedCount =
            currentFolderId === null
              ? 0
              : folders.find((item) => item.id === currentFolderId)?.viewer_count ?? 0;
          setFolders((prev) => [
            ...prev,
            { ...folder, viewer_count: folder.viewer_count ?? inheritedCount },
          ]);
          setError(null);
        }}
        onAddFile={async ({ name, color, kind, url, notes }) => {
          const { file } = await createCollectionFile(userId, name, {
            folderId: currentFolderId,
            color,
            kind,
            url,
            notes,
          });
          setFiles((prev) => [...prev, file]);
          setError(null);
        }}
        onEditFolder={async (folder, { name, color }) => {
          const { folder: updated } = await updateCollectionFolder(
            userId,
            folder.id,
            name,
            color,
          );
          setFolders((prev) =>
            prev.map((item) =>
              item.id === folder.id
                ? { ...updated, viewer_count: item.viewer_count }
                : item,
            ),
          );
          setError(null);
        }}
        onEditFile={async (file, { name, color, url, notes }) => {
          const { file: updated } = await updateCollectionFile(
            userId,
            file.id,
            name,
            color,
            { url, notes },
          );
          setFiles((prev) =>
            prev.map((item) => (item.id === file.id ? updated : item)),
          );
          setError(null);
        }}
        onDeleteFolder={async (folder) => {
          await deleteCollectionFolder(userId, folder.id);
          await loadTree(userId);
          if (currentFolderId === folder.id) {
            setCurrentFolderId(folder.parent_folder_id);
          }
          setError(null);
        }}
        onDeleteFile={async (file) => {
          await deleteCollectionFile(userId, file.id);
          setFiles((prev) => prev.filter((item) => item.id !== file.id));
          setError(null);
        }}
        onSharesChanged={async () => {
          await loadTree(userId);
        }}
      />
    </main>
  );
}
