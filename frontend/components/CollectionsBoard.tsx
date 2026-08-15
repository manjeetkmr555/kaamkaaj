"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AddCollectionFileModal } from "@/components/AddCollectionFileModal";
import { AddCollectionFolderModal } from "@/components/AddCollectionFolderModal";
import { EditCollectionItemModal } from "@/components/EditCollectionItemModal";
import { ShareCollectionItemModal } from "@/components/ShareCollectionItemModal";
import type {
  CollectionFile,
  CollectionFileColor,
  CollectionFolder,
  CollectionItemKind,
} from "@/lib/collectionsApi";
import { COLLECTION_FILE_COLORS } from "@/lib/collectionsApi";
import { getCollectionFilePreviewUrl } from "@/lib/collectionPreview";

type ViewMode = "list" | "grid";
type SortMode = "all" | "folder" | "file" | "image" | "color";
type ColorFilter = CollectionFileColor | "all";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "folder", label: "Folder" },
  { value: "file", label: "File" },
  { value: "image", label: "Image" },
  { value: "color", label: "Colour" },
];

const COLOR_FILTER_OPTIONS: { value: ColorFilter; label: string }[] = [
  { value: "all", label: "All colours" },
  ...COLLECTION_FILE_COLORS.map((color) => ({
    value: color.value,
    label: color.label,
  })),
];

const COLOR_ORDER = new Map(
  [
    "#b91c1c",
    "#ea580c",
    "#ca8a04",
    "#15803d",
    "#1d4ed8",
    "#7c3aed",
  ].map((color, index) => [color, index]),
);

function compareByRecency(aUpdatedAt: string, bUpdatedAt: string) {
  return new Date(bUpdatedAt).getTime() - new Date(aUpdatedAt).getTime();
}

function compareByColor(
  aColor: string,
  bColor: string,
  aUpdatedAt: string,
  bUpdatedAt: string,
) {
  const aOrder = COLOR_ORDER.get(aColor) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = COLOR_ORDER.get(bColor) ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return compareByRecency(aUpdatedAt, bUpdatedAt);
}

type CollectionsBoardProps = {
  ownerUserId: number;
  folders: CollectionFolder[];
  files: CollectionFile[];
  currentFolderId: number | null;
  onOpenFolder: (folderId: number | null) => void;
  onAddFolder: (input: {
    name: string;
    color: CollectionFileColor;
  }) => Promise<void>;
  onAddFile: (input: {
    name: string;
    color: CollectionFileColor;
    kind: CollectionItemKind;
    url?: string;
    notes?: string;
  }) => Promise<void>;
  onEditFolder: (
    folder: CollectionFolder,
    input: { name: string; color: CollectionFileColor },
  ) => Promise<void>;
  onEditFile: (
    file: CollectionFile,
    input: {
      name: string;
      color: CollectionFileColor;
      url?: string | null;
      notes?: string | null;
    },
  ) => Promise<void>;
  onDeleteFolder: (folder: CollectionFolder) => Promise<void>;
  onDeleteFile: (file: CollectionFile) => Promise<void>;
  onSharesChanged?: () => Promise<void> | void;
};

export function CollectionsBoard({
  ownerUserId,
  folders,
  files,
  currentFolderId,
  onOpenFolder,
  onAddFolder,
  onAddFile,
  onEditFolder,
  onEditFile,
  onDeleteFolder,
  onDeleteFile,
  onSharesChanged,
}: CollectionsBoardProps) {
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<CollectionFolder | null>(
    null,
  );
  const [editingFile, setEditingFile] = useState<CollectionFile | null>(null);
  const [sharingItem, setSharingItem] = useState<{
    id: number;
    name: string;
    kind: "folder" | "file";
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("all");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "All";
  const activeColorLabel =
    COLOR_FILTER_OPTIONS.find((option) => option.value === colorFilter)
      ?.label ?? "All colours";

  const folderById = useMemo(() => {
    const map = new Map<number, CollectionFolder>();
    for (const folder of folders) map.set(folder.id, folder);
    return map;
  }, [folders]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { id: number | null; name: string }[] = [
      { id: null, name: "Collections" },
    ];
    let cursor = currentFolderId;
    const trail: CollectionFolder[] = [];
    while (cursor !== null) {
      const folder = folderById.get(cursor);
      if (!folder) break;
      trail.unshift(folder);
      cursor = folder.parent_folder_id;
    }
    for (const folder of trail) {
      crumbs.push({ id: folder.id, name: folder.name });
    }
    return crumbs;
  }, [currentFolderId, folderById]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const childFolders = useMemo(() => {
    if (sortMode === "file" || sortMode === "image") return [];
    const items = folders.filter((folder) => {
      if (folder.parent_folder_id !== currentFolderId) return false;
      if (
        sortMode === "color" &&
        colorFilter !== "all" &&
        folder.color !== colorFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return folder.name.toLowerCase().includes(normalizedQuery);
    });
    return items;
  }, [folders, currentFolderId, sortMode, colorFilter, normalizedQuery]);

  const childFiles = useMemo(() => {
    if (sortMode === "folder") return [];
    const items = files.filter((file) => {
      if (file.folder_id !== currentFolderId) return false;
      if (sortMode === "file" && file.kind === "image") return false;
      if (sortMode === "image" && file.kind !== "image") return false;
      if (
        sortMode === "color" &&
        colorFilter !== "all" &&
        file.color !== colorFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return file.name.toLowerCase().includes(normalizedQuery);
    });
    return items;
  }, [files, currentFolderId, sortMode, colorFilter, normalizedQuery]);

  const boardItems = useMemo(() => {
    const foldersAsItems = childFolders.map((folder) => ({
      type: "folder" as const,
      folder,
      color: folder.color,
      updatedAt: folder.updated_at,
    }));
    const filesAsItems = childFiles.map((file) => ({
      type: "file" as const,
      file,
      color: file.color,
      updatedAt: file.updated_at,
    }));
    return [...foldersAsItems, ...filesAsItems].sort((a, b) =>
      sortMode === "color"
        ? compareByColor(a.color, b.color, a.updatedAt, b.updatedAt)
        : compareByRecency(a.updatedAt, b.updatedAt),
    );
  }, [childFolders, childFiles, sortMode]);

  const folderContentsById = useMemo(() => {
    const counts = new Map<
      number,
      { subfolders: number; files: number; images: number }
    >();
    for (const folder of folders) {
      counts.set(folder.id, { subfolders: 0, files: 0, images: 0 });
    }
    for (const folder of folders) {
      if (folder.parent_folder_id === null) continue;
      const parent = counts.get(folder.parent_folder_id);
      if (parent) parent.subfolders += 1;
    }
    for (const file of files) {
      if (file.folder_id === null) continue;
      const parent = counts.get(file.folder_id);
      if (!parent) continue;
      if (file.kind === "image") parent.images += 1;
      else parent.files += 1;
    }
    return counts;
  }, [folders, files]);

  return (
    <div className="collections-board mx-auto max-w-4xl">
      <div className="collections-actions">
        <button
          type="button"
          className="share-trigger-btn collections-action-btn"
          onClick={() => setFolderModalOpen(true)}
        >
          <span aria-hidden>+</span>
          <FolderIcon />
          <span></span>
        </button>
        <button
          type="button"
          className="share-trigger-btn collections-action-btn"
          onClick={() => setFileModalOpen(true)}
          aria-label="Add file"
          title="Add file"
        >
          <span aria-hidden>+</span>
          <FileIcon />
          <span></span>
        </button>
        <button
          type="button"
          className="share-trigger-btn collections-action-btn"
          onClick={() => setImageModalOpen(true)}
          aria-label="Add image"
          title="Add image"
        >
          <span aria-hidden>+</span>
          <ImageIcon />
          <span></span>
        </button>
        <div className="collections-sort">
          <button
            type="button"
            className="share-trigger-btn collections-action-btn"
            onClick={() => {
              setSortMenuOpen((open) => !open);
              setColorMenuOpen(false);
            }}
            aria-expanded={sortMenuOpen}
            aria-haspopup="menu"
          >
            Sort by: {activeSortLabel}
            <span aria-hidden>▾</span>
          </button>
          {sortMenuOpen ? (
            <div className="collections-sort__menu" role="menu">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortMode === option.value}
                  className={`collections-sort__option ${
                    sortMode === option.value
                      ? "collections-sort__option--active"
                      : ""
                  }`}
                  onClick={() => {
                    setSortMode(option.value);
                    setSortMenuOpen(false);
                    if (option.value === "color") {
                      setColorMenuOpen(true);
                    } else {
                      setColorFilter("all");
                      setColorMenuOpen(false);
                    }
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {sortMode === "color" ? (
          <div className="collections-sort collections-color-filter">
            <button
              type="button"
              className="share-trigger-btn collections-action-btn"
              onClick={() => {
                setColorMenuOpen((open) => !open);
                setSortMenuOpen(false);
              }}
              aria-expanded={colorMenuOpen}
              aria-haspopup="menu"
            >
              {colorFilter !== "all" ? (
                <span
                  className="collections-color-filter__swatch"
                  style={{ backgroundColor: colorFilter }}
                  aria-hidden
                />
              ) : null}
              Colour: {activeColorLabel}
              <span aria-hidden>▾</span>
            </button>
            {colorMenuOpen ? (
              <div className="collections-sort__menu" role="menu">
                {COLOR_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={colorFilter === option.value}
                    className={`collections-sort__option collections-color-filter__option ${
                      colorFilter === option.value
                        ? "collections-sort__option--active"
                        : ""
                    }`}
                    onClick={() => {
                      setColorFilter(option.value);
                      setColorMenuOpen(false);
                    }}
                  >
                    {option.value === "all" ? (
                      <span
                        className="collections-color-filter__swatch collections-color-filter__swatch--all"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="collections-color-filter__swatch"
                        style={{ backgroundColor: option.value }}
                        aria-hidden
                      />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <label className="collections-search">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="collections-search__input"
          />
        </label>
        <div className="collections-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`collections-view-btn ${
              viewMode === "grid" ? "collections-view-btn--active" : ""
            }`}
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view"
            title="Grid view"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            className={`collections-view-btn ${
              viewMode === "list" ? "collections-view-btn--active" : ""
            }`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            aria-label="List view"
            title="List view"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      <nav className="collections-breadcrumbs" aria-label="Folder path">
        {breadcrumbs.map((crumb, index) => (
          <span
            key={`${crumb.id ?? "root"}-${index}`}
            className="collections-breadcrumbs__item"
          >
            {index > 0 ? (
              <span className="collections-breadcrumbs__sep" aria-hidden>
                /
              </span>
            ) : null}
            <button
              type="button"
              className={
                crumb.id === currentFolderId
                  ? "collections-breadcrumbs__current"
                  : "collections-breadcrumbs__link"
              }
              onClick={() => onOpenFolder(crumb.id)}
              disabled={crumb.id === currentFolderId}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <ul
        className={
          viewMode === "grid" ? "collections-list collections-list--grid" : "collections-list"
        }
      >
        {boardItems.map((item) => {
          if (item.type === "folder") {
            const folder = item.folder;
            const contents = folderContentsById.get(folder.id) ?? {
              subfolders: 0,
              files: 0,
              images: 0,
            };
            return (
              <li
                key={`folder-${folder.id}`}
                className={`collections-row collections-row--folder ${
                  viewMode === "grid" ? "collections-row--grid" : ""
                }`}
                style={
                  {
                    "--row-color": folder.color || "#1d4ed8",
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  className="collections-row__main"
                  onClick={() => onOpenFolder(folder.id)}
                >
                  <span
                    className="collections-row__icon"
                    style={{ color: folder.color || "#1d4ed8" }}
                    aria-hidden
                  >
                    <FolderIcon />
                  </span>
                  <span className="collections-row__meta">
                    <span className="collections-row__name">{folder.name}</span>
                  </span>
                </button>
                <div
                  className="collections-row__stats"
                  aria-label={`${contents.subfolders} folders, ${contents.files} files, ${contents.images} images, shared with ${folder.viewer_count ?? 0} people`}
                >
                  <span className="collections-row__stat">
                    <FolderIcon />
                    {contents.subfolders}
                  </span>
                  <span className="collections-row__stat">
                    <FileIcon />
                    {contents.files}
                  </span>
                  <span className="collections-row__stat">
                    <ImageIcon />
                    {contents.images}
                  </span>
                  <span className="collections-row__stat">
                    <EyeIcon />
                    {folder.viewer_count ?? 0}
                  </span>
                </div>
                <div className="collections-row__actions">
                  <button
                    type="button"
                    className="collections-row__share"
                    onClick={() =>
                      setSharingItem({
                        id: folder.id,
                        name: folder.name,
                        kind: "folder",
                      })
                    }
                    aria-label={`Share folder ${folder.name}`}
                  >
                    <ShareIcon />
                  </button>
                  <button
                    type="button"
                    className="collections-row__edit"
                    onClick={() => setEditingFolder(folder)}
                    aria-label={`Edit folder ${folder.name}`}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="collections-row__delete"
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Delete folder "${folder.name}" and everything inside it?`,
                      );
                      if (confirmed) void onDeleteFolder(folder);
                    }}
                    aria-label={`Delete folder ${folder.name}`}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          }

          const file = item.file;
          const viewerCount =
            file.folder_id === null
              ? 0
              : folderById.get(file.folder_id)?.viewer_count ?? 0;
          const itemLabel = file.kind === "image" ? "image" : "file";
          const previewUrl =
            viewMode === "grid"
              ? getCollectionFilePreviewUrl({
                  url: file.url,
                  previewImageUrl: file.preview_image_url,
                })
              : null;
          return (
            <li
              key={`file-${file.id}`}
              className={`collections-row collections-row--file ${
                viewMode === "grid" ? "collections-row--grid" : ""
              } ${previewUrl ? "collections-row--has-preview" : ""}`}
              style={
                {
                  "--row-color": file.color || "#1d4ed8",
                  ...(previewUrl
                    ? { "--preview-image": `url(${JSON.stringify(previewUrl)})` }
                    : {}),
                } as CSSProperties
              }
            >
              <div className="collections-row__main collections-row__main--static">
                <span
                  className="collections-row__icon"
                  style={{ color: file.color || "#1d4ed8" }}
                  aria-hidden
                >
                  {file.kind === "image" ? <ImageIcon /> : <FileIcon />}
                </span>
                <span className="collections-row__meta">
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="collections-row__name collections-row__name--link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {file.name}
                    </a>
                  ) : (
                    <span className="collections-row__name">{file.name}</span>
                  )}
                  {file.notes ? (
                    <span className="collections-row__notes">{file.notes}</span>
                  ) : null}
                </span>
              </div>
              <div
                className="collections-row__stats"
                aria-label={`Shared with ${viewerCount} people`}
              >
                <span className="collections-row__stat">
                  <EyeIcon />
                  {viewerCount}
                </span>
              </div>
              <div className="collections-row__actions">
                <button
                  type="button"
                  className="collections-row__share"
                  onClick={() =>
                    setSharingItem({
                      id: file.id,
                      name: file.name,
                      kind: "file",
                    })
                  }
                  aria-label={`Share ${itemLabel} ${file.name}`}
                >
                  <ShareIcon />
                </button>
                <button
                  type="button"
                  className="collections-row__edit"
                  onClick={() => setEditingFile(file)}
                  aria-label={`Edit ${itemLabel} ${file.name}`}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="collections-row__delete"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete ${itemLabel} "${file.name}" from your collection?`,
                    );
                    if (confirmed) void onDeleteFile(file);
                  }}
                  aria-label={`Delete ${itemLabel} ${file.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {boardItems.length === 0 ? (
        <p className="collections-empty">
          {normalizedQuery
            ? `No results for “${searchQuery.trim()}”.`
            : sortMode === "folder"
              ? "No folders here yet."
              : sortMode === "file"
                ? "No files here yet."
                : sortMode === "image"
                  ? "No images here yet."
                  : sortMode === "color" && colorFilter !== "all"
                    ? `No items in ${activeColorLabel.toLowerCase()}.`
                    : "This folder is empty. Add a folder, file, or image to get started."}
        </p>
      ) : null}

      <AddCollectionFolderModal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onAdd={onAddFolder}
      />
      <AddCollectionFileModal
        open={fileModalOpen}
        kind="file"
        onClose={() => setFileModalOpen(false)}
        onAdd={onAddFile}
      />
      <AddCollectionFileModal
        open={imageModalOpen}
        kind="image"
        onClose={() => setImageModalOpen(false)}
        onAdd={onAddFile}
      />
      <EditCollectionItemModal
        open={editingFolder !== null}
        kind="folder"
        initialName={editingFolder?.name ?? ""}
        initialColor={editingFolder?.color ?? "#1d4ed8"}
        onClose={() => setEditingFolder(null)}
        onSave={async (input) => {
          if (!editingFolder) return;
          await onEditFolder(editingFolder, input);
        }}
      />
      <ShareCollectionItemModal
        open={sharingItem !== null}
        ownerUserId={ownerUserId}
        item={sharingItem}
        onClose={() => setSharingItem(null)}
        onChanged={() => {
          void onSharesChanged?.();
        }}
      />
      <EditCollectionItemModal
        open={editingFile !== null}
        kind={editingFile?.kind === "image" ? "image" : "file"}
        initialName={editingFile?.name ?? ""}
        initialColor={editingFile?.color ?? "#1d4ed8"}
        initialUrl={editingFile?.url ?? null}
        initialNotes={editingFile?.notes ?? null}
        onClose={() => setEditingFile(null)}
        onSave={async (input) => {
          if (!editingFile) return;
          await onEditFile(editingFile, input);
        }}
      />
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M1.5 10s3.2-5.5 8.5-5.5S18.5 10 18.5 10s-3.2 5.5-8.5 5.5S1.5 10 1.5 10z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M2.5 5.5A1.5 1.5 0 014 4h4.2l1.3 1.5H16a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-9z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5.5 2.5h6l3 3V16a1.5 1.5 0 01-1.5 1.5h-7.5A1.5 1.5 0 014 16V4A1.5 1.5 0 015.5 2.5z"
        fill="currentColor"
        opacity="0.8"
      />
      <path d="M11.5 2.5V5.5H14.5" stroke="white" strokeWidth="1.25" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="4"
        width="15"
        height="12"
        rx="1.5"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="7" cy="8.25" r="1.4" fill="white" />
      <path
        d="M3.5 14.5l3.8-3.6 2.4 2.2 2.6-3.1 4.2 4.5"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M8.8 2.4l2.8 2.8M2 12l.7-2.8L9.6 2.3a1 1 0 011.4 0l.7.7a1 1 0 010 1.4L4.8 11.3 2 12z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="4" cy="7" r="1.5" fill="currentColor" />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" />
      <circle cx="10" cy="11" r="1.5" fill="currentColor" />
      <path d="M5.3 6.2L8.7 3.8M5.3 7.8l3.4 2.4" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="2" width="12" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="6" width="12" height="2" rx="0.5" fill="currentColor" />
      <rect x="1" y="10" width="12" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}
