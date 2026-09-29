import { CirclePlus, FolderPlus, Upload } from 'lucide-react'
import type { RefObject } from 'react'

type Props = {
  collectionImportRef: RefObject<HTMLInputElement>
  packageImportRef: RefObject<HTMLInputElement>
  importCollectionsFile: (file: File | null) => Promise<void>
  importPackageAsNewWorkflowFile: (file: File | null) => Promise<void>
  createFolderAction: () => void
  createWorkflowAction: () => void
}

export function WorkflowHubListHeader({
  collectionImportRef,
  packageImportRef,
  importCollectionsFile,
  importPackageAsNewWorkflowFile,
  createFolderAction,
  createWorkflowAction,
}: Props) {
  return (
    <header className="wf-list-head">
      <div>
        <h2>Workflow</h2>
        <p>Khu vực riêng để tạo, clone và tổ chức nhiều workflow cho nhiều mục đích khác nhau.</p>
      </div>
      <div className="wf-list-head-actions">
        <input
          ref={collectionImportRef}
          type="file"
          accept="application/json,.json"
          className="wf-hidden-file-input"
          onChange={(event) => {
            void importCollectionsFile(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />
        <input
          ref={packageImportRef}
          type="file"
          accept="application/json,.json"
          className="wf-hidden-file-input"
          onChange={(event) => {
            void importPackageAsNewWorkflowFile(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />
        <button type="button" className="wf-secondary-btn" onClick={createFolderAction}>
          <FolderPlus size={15} />
          Thư mục mới
        </button>
        <button type="button" className="wf-secondary-btn" onClick={() => packageImportRef.current?.click()}>
          <Upload size={15} />
          Nhập gói
        </button>
        <button type="button" className="wf-primary-btn" onClick={createWorkflowAction}>
          <CirclePlus size={15} />
          Workflow mới
        </button>
      </div>
    </header>
  )
}
