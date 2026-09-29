import { useRef, useState } from 'react'
import { CirclePlus, Download, FolderPlus, FolderTree, Pencil, Save, Star, Trash2, Upload, Wand2 } from 'lucide-react'
import type { WorkflowDefinition, WorkflowFolder, WorkflowMedia } from '../../lib/workflows'
import { WORKFLOW_WIZARD_PRESETS, type WorkflowWizardPreset } from './workflowHubPresets'
import { WorkflowHubCollapsibleSection } from './WorkflowHubCollapsibleSection'
import { WorkflowLocalPresetPanel, WorkflowWizardPresetPanel } from './WorkflowHubPresetPanels'
import type { WorkflowCollection } from './useWorkflowHubLibraryData'

type LocalWorkflowPreset = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

type FilterFolderId = string | 'all'

type Props = {
  folderId: FilterFolderId
  workflows: WorkflowDefinition[]
  folders: WorkflowFolder[]
  setFolderId: (folderId: FilterFolderId) => void
  createFolderAction: () => void
  renameFolderAction: (folder: WorkflowFolder, newName: string) => void
  deleteFolderAction: (folder: WorkflowFolder) => void
  activeLibraryCollectionId: string
  setActiveLibraryCollectionId: (collectionId: string) => void
  favoriteWorkflowIds: string[]
  customCollections: WorkflowCollection[]
  createCustomCollectionAction: () => void
  renameCustomCollectionAction: (collection: WorkflowCollection, newName: string) => void
  deleteCustomCollectionAction: (collection: WorkflowCollection) => void
  exportCollectionsAction: () => void
  onImportCollectionsClick: () => void
  selectedWizardPresetId: string | null
  setSelectedWizardPresetId: (presetId: string) => void
  createWorkflowFromWizardPresetAction: (preset: WorkflowWizardPreset) => Promise<void>
  mediaLabel: (media: WorkflowMedia) => string
  localWorkflowPresets: LocalWorkflowPreset[]
  selectedLocalPresetId: string | null
  setSelectedLocalPresetId: (presetId: string) => void
  createWorkflowFromDefinitionAction: (
    workflow: WorkflowDefinition,
    options?: { suggestedName?: string; openInEditor?: boolean },
  ) => Promise<void>
  relativeTime: (iso: string) => string
  previewWorkflowMetadataEntries: (workflow: WorkflowDefinition) => [string, string][]
}

export function WorkflowHubLibrarySidebar({
  folderId,
  workflows,
  folders,
  setFolderId,
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  activeLibraryCollectionId,
  setActiveLibraryCollectionId,
  favoriteWorkflowIds,
  customCollections,
  createCustomCollectionAction,
  renameCustomCollectionAction,
  deleteCustomCollectionAction,
  exportCollectionsAction,
  onImportCollectionsClick,
  selectedWizardPresetId,
  setSelectedWizardPresetId,
  createWorkflowFromWizardPresetAction,
  mediaLabel,
  localWorkflowPresets,
  selectedLocalPresetId,
  setSelectedLocalPresetId,
  createWorkflowFromDefinitionAction,
  relativeTime,
  previewWorkflowMetadataEntries,
}: Props) {
  // 2026-07-26e: o nhap doi ten inline thay cho window.prompt() (bi chan am tham o mot so trinh duyet/app).
  // Bam icon but -> hien input tai cho -> Enter/blur de luu, Escape de huy khong luu.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [folderNameDraft, setFolderNameDraft] = useState('')
  const cancelingFolderRenameRef = useRef(false)

  const startFolderRename = (folder: WorkflowFolder) => {
    setRenamingFolderId(folder.id)
    setFolderNameDraft(folder.name)
  }
  const commitFolderRename = (folder: WorkflowFolder) => {
    if (cancelingFolderRenameRef.current) {
      cancelingFolderRenameRef.current = false
      return
    }
    const trimmed = folderNameDraft.trim()
    setRenamingFolderId(null)
    if (trimmed && trimmed !== folder.name) renameFolderAction(folder, trimmed)
  }
  const cancelFolderRename = () => {
    cancelingFolderRenameRef.current = true
    setRenamingFolderId(null)
  }

  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null)
  const [collectionNameDraft, setCollectionNameDraft] = useState('')
  const cancelingCollectionRenameRef = useRef(false)

  const startCollectionRename = (collection: WorkflowCollection) => {
    setRenamingCollectionId(collection.id)
    setCollectionNameDraft(collection.name)
  }
  const commitCollectionRename = (collection: WorkflowCollection) => {
    if (cancelingCollectionRenameRef.current) {
      cancelingCollectionRenameRef.current = false
      return
    }
    const trimmed = collectionNameDraft.trim()
    setRenamingCollectionId(null)
    if (trimmed && trimmed !== collection.name) renameCustomCollectionAction(collection, trimmed)
  }
  const cancelCollectionRename = () => {
    cancelingCollectionRenameRef.current = true
    setRenamingCollectionId(null)
  }

  return (
    <aside className="wf-sidebar">
      <WorkflowHubCollapsibleSection
        title="Thư viện của tôi"
        icon={<FolderTree size={16} />}
        summary="Thư mục và bộ sưu tập"
        defaultOpen
        storageKey="notiagent.workflowSidebarGroup.library"
      >
        <WorkflowHubCollapsibleSection
          title="Thư mục"
          icon={<FolderTree size={16} />}
          summary="Lọc theo nhóm chính"
          count={folders.length + 1}
          defaultOpen
          nested
        >
          <button
            type="button"
            className={`wf-folder-item${folderId === 'all' ? ' active' : ''}`}
            onClick={() => setFolderId('all')}
          >
            <span>Tất cả workflow</span>
            <small>{workflows.length}</small>
          </button>
          {folders.map((folder) => {
            const count = workflows.filter((workflow) => workflow.folderId === folder.id).length
            const isRenaming = renamingFolderId === folder.id
            return (
              <div key={folder.id} className="wf-folder-row">
                {isRenaming ? (
                  <input
                    type="text"
                    className="wf-inline-rename-input"
                    value={folderNameDraft}
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setFolderNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitFolderRename(folder)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelFolderRename()
                      }
                    }}
                    onBlur={() => commitFolderRename(folder)}
                    aria-label={`Đổi tên thư mục ${folder.name}`}
                  />
                ) : (
                  <button
                    type="button"
                    className={`wf-folder-item${folderId === folder.id ? ' active' : ''}`}
                    onClick={() => setFolderId(folder.id)}
                  >
                    <span>{folder.name}</span>
                    <small>{count}</small>
                  </button>
                )}
                {!folder.system && !isRenaming && (
                  <div className="wf-folder-actions">
                    <button type="button" onClick={() => startFolderRename(folder)} aria-label="Đổi tên thư mục">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => deleteFolderAction(folder)} aria-label="Xóa thư mục">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </WorkflowHubCollapsibleSection>

        <WorkflowHubCollapsibleSection
          title="Bộ sưu tập"
          icon={<Star size={16} />}
          summary="Yêu thích và bộ sưu tập riêng"
          count={customCollections.length + 2}
          nested
        >
          <div className="wf-folder-row">
            <button
              type="button"
              className={`wf-folder-item${activeLibraryCollectionId === 'all' ? ' active' : ''}`}
              onClick={() => setActiveLibraryCollectionId('all')}
            >
              <span>Tất cả bộ sưu tập</span>
              <small>{workflows.length}</small>
            </button>
          </div>
          <div className="wf-folder-row">
            <button
              type="button"
              className={`wf-folder-item${activeLibraryCollectionId === 'favorites' ? ' active' : ''}`}
              onClick={() => setActiveLibraryCollectionId('favorites')}
            >
              <span>Yêu thích</span>
              <small>{favoriteWorkflowIds.length}</small>
            </button>
          </div>
          {customCollections.map((collection) => {
            const isRenaming = renamingCollectionId === collection.id
            return (
              <div key={collection.id} className="wf-folder-row">
                {isRenaming ? (
                  <input
                    type="text"
                    className="wf-inline-rename-input"
                    value={collectionNameDraft}
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setCollectionNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitCollectionRename(collection)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelCollectionRename()
                      }
                    }}
                    onBlur={() => commitCollectionRename(collection)}
                    aria-label={`Đổi tên bộ sưu tập ${collection.name}`}
                  />
                ) : (
                  <button
                    type="button"
                    className={`wf-folder-item${activeLibraryCollectionId === collection.id ? ' active' : ''}`}
                    onClick={() => setActiveLibraryCollectionId(collection.id)}
                  >
                    <span>{collection.name}</span>
                    <small>{collection.workflowIds.length}</small>
                  </button>
                )}
                {!isRenaming && (
                  <div className="wf-folder-actions">
                    <button type="button" onClick={() => startCollectionRename(collection)} aria-label="Đổi tên bộ sưu tập">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => deleteCustomCollectionAction(collection)} aria-label="Xóa bộ sưu tập">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <div className="wf-inline-presets">
            <button type="button" className="wf-secondary-btn" onClick={createCustomCollectionAction}>
              <CirclePlus size={14} />
              Bộ sưu tập mới
            </button>
            <button type="button" className="wf-secondary-btn" onClick={exportCollectionsAction}>
              <Download size={14} />
              Xuất
            </button>
            <button type="button" className="wf-secondary-btn" onClick={onImportCollectionsClick}>
              <Upload size={14} />
              Nhập
            </button>
          </div>
        </WorkflowHubCollapsibleSection>
      </WorkflowHubCollapsibleSection>

      <WorkflowHubCollapsibleSection
        title="Tạo nhanh"
        icon={<Wand2 size={16} />}
        summary="Wizard, mẫu và preset"
        storageKey="notiagent.workflowSidebarGroup.quickCreate"
      >
        <WorkflowHubCollapsibleSection
          title="Trình tạo workflow"
          icon={<Wand2 size={16} />}
          summary="Tạo nhanh theo use-case"
          count={WORKFLOW_WIZARD_PRESETS.length}
          nested
        >
          <p className="wf-panel-hint">Tạo nhanh workflow hoàn chỉnh theo use-case mà không cần ghép node thủ công từ đầu.</p>
          <WorkflowWizardPresetPanel
            presets={WORKFLOW_WIZARD_PRESETS}
            selectedPresetId={selectedWizardPresetId}
            onSelectPreset={setSelectedWizardPresetId}
            onPrimaryAction={(preset) => {
              void createWorkflowFromWizardPresetAction(preset)
            }}
            primaryLabel="Tạo workflow"
            mediaLabel={mediaLabel}
            previewMetaLabel="Nguồn: trình tạo"
          />
        </WorkflowHubCollapsibleSection>

        {/* 2026-07-28: da xoa han khoi "Workflow mau" (STARTER_COLLECTIONS) o day - doc code
            xac nhan no lay dung 1 nguon du lieu voi thu muc "Templates" trong "Thu vien cua toi"
            phia tren (ca hai deu la workflow.category === 'template'), chi khac cach hien thi:
            khoi nay la ban rut gon 6 item + khong co nut Xoa/Xuat ban, con thu muc Templates la
            danh sach day du kem tim kiem + toan bo hanh dong. Trung lap that 100%, khong mat
            chuc nang gi vi thu muc Templates da lam duoc moi viec khoi nay lam va nhieu hon. */}

        <WorkflowHubCollapsibleSection
          title="Preset cục bộ"
          icon={<Save size={16} />}
          summary="Preset lưu trong trình duyệt"
          count={localWorkflowPresets.length}
          nested
        >
          <p className="wf-panel-hint">Tạo workflow mới trực tiếp từ preset local đã lưu trong trình duyệt.</p>
          {localWorkflowPresets.length === 0 ? (
            <p className="wf-panel-hint">Chưa có preset local nào. Hãy lưu preset trong editor trước.</p>
          ) : (
            <WorkflowLocalPresetPanel
              presets={localWorkflowPresets.slice(0, 8)}
              selectedPresetId={selectedLocalPresetId}
              onSelectPreset={setSelectedLocalPresetId}
              onPrimaryAction={(preset) => {
                void createWorkflowFromDefinitionAction(preset.workflow, { suggestedName: preset.name, openInEditor: true })
              }}
              primaryLabel="Tạo workflow"
              mode="create"
              mediaLabel={mediaLabel}
              relativeTime={relativeTime}
              metadataEntries={previewWorkflowMetadataEntries}
            />
          )}
        </WorkflowHubCollapsibleSection>
      </WorkflowHubCollapsibleSection>
    </aside>
  )
}
