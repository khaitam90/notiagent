import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { WorkflowDefinition, WorkflowRun } from '../../lib/workflows'
import { runWorkflow } from '../../lib/workflowApi'

type RuntimeMode = 'image' | 'video' | 'automation'

type UseWorkflowHubRunActionsParams = {
  draftWorkflow: WorkflowDefinition | null
  workflowValidationErrors: { message: string }[]
  runVariablesJson: string
  runInputValues: Record<string, string>
  currentMode: RuntimeMode
  currentNeedsReference: boolean
  runMode: 'image' | 'video'
  setIsRunning: Dispatch<SetStateAction<boolean>>
  setRuns: Dispatch<SetStateAction<WorkflowRun[]>>
  setSelectedRunId: Dispatch<SetStateAction<string | null>>
  setSelectedTraceNodeId: Dispatch<SetStateAction<string | null>>
  setError: Dispatch<SetStateAction<string | null>>
  errorMessage: (error: unknown) => string
  validationIssueLines: (messages: { message: string }[]) => string
  isDirty: boolean
  saveWorkflowDraft: () => Promise<void>
}

export function useWorkflowHubRunActions({
  draftWorkflow,
  workflowValidationErrors,
  runVariablesJson,
  runInputValues,
  currentMode,
  currentNeedsReference,
  runMode,
  setIsRunning,
  setRuns,
  setSelectedRunId,
  setSelectedTraceNodeId,
  setError,
  errorMessage,
  validationIssueLines,
  isDirty,
  saveWorkflowDraft,
}: UseWorkflowHubRunActionsParams) {
  const runWorkflowAction = useCallback(async (targetNodeId?: string) => {
    if (!draftWorkflow) return
    if (workflowValidationErrors.length > 0) {
      window.alert(`Workflow chưa hợp lệ để chạy:\n${validationIssueLines(workflowValidationErrors)}`)
      return
    }
    let variables: Record<string, unknown> = {}
    if (runVariablesJson.trim()) {
      try {
        const parsed = JSON.parse(runVariablesJson) as unknown
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          window.alert('Biến JSON phải là một object, ví dụ {"media_type":"image"}')
          return
        }
        variables = parsed as Record<string, unknown>
      } catch {
        window.alert('Biến JSON không hợp lệ.')
        return
      }
    }
    const promptValue = String(runInputValues.prompt || runInputValues.scene_description || '').trim()
    const referenceImageValue = String(runInputValues.reference_image || runInputValues.image_url || '').trim()
    const videoUrlValue = String(runInputValues.video_url || '').trim()
    const audioUrlValue = String(runInputValues.audio_url || '').trim()
    const aspectRatioValue = String(runInputValues.aspect_ratio || runInputValues.ratio || '16:9').trim() || '16:9'
    const durationValue = Math.max(1, Number.parseInt(String(runInputValues.duration || '5'), 10) || 5)
    const toolIdValue = String(runInputValues.tool_id || '').trim()
    const dynamicVariables: Record<string, unknown> = { ...variables }
    for (const [field, value] of Object.entries(runInputValues)) {
      const clean = String(value || '').trim()
      if (!clean) continue
      if (['prompt', 'aspect_ratio', 'ratio', 'duration', 'tool_id', 'image_url', 'video_url', 'audio_url', 'reference_image'].includes(field)) continue
      dynamicVariables[field] = clean
    }
    if (referenceImageValue) dynamicVariables.reference_image = referenceImageValue
    if (videoUrlValue) dynamicVariables.video_url = videoUrlValue
    if (audioUrlValue) dynamicVariables.audio_url = audioUrlValue
    if (currentMode !== 'automation' && !promptValue) {
      window.alert('Cần nhập prompt để chạy workflow.')
      return
    }
    if (currentNeedsReference && !referenceImageValue && typeof dynamicVariables.reference_image !== 'string') {
      window.alert('Workflow này cần URL ảnh tham chiếu.')
      return
    }
    setIsRunning(true)
    try {
      // 2026-07-30: Sep bao go prompt/cong thuc THANG TREN NODE (vi tri 1, o "CONG THUC PROMPT
      // (NODE)" tren canvas, bam "Luu" ngay trong khung do) roi bam "Chay workflow" thi he thong
      // KHONG nhan noi dung vua go - phai go lai vao o "Noi dung ban muon tao" trong panel ben trai
      // (vi tri 2) moi chay dung. Root cause: nut "Luu" tren khung sua node chi ghi vao STATE nhap
      // (draftWorkflow) trong trinh duyet, KHONG goi API luu len server. Backend
      // POST /api/workflows/{id}/run lai doc workflow TU BAN DA LUU TREN SERVER
      // (workflow_store.get_workflow), khong biet gi ve chinh sua chua luu - nen chay ban CU. Nut
      // rieng "Luu thay doi" o toolbar canvas moi that su goi API luu (saveWorkflowDraft) - neu
      // Sep quen bam no truoc khi Chay workflow, moi thay doi tren node (template, cau hinh model...)
      // bi bo qua am tham, khong bao loi gi ca. Fix tan goc: tu dong luu draft truoc khi chay neu
      // dang co thay doi chua luu (isDirty) - nguoi dung khong con phai nho bam "Luu thay doi" rieng
      // truoc "Chay workflow" nua. saveWorkflowDraft tu kiem tra category==='custom' va validation,
      // an toan khi goi cho workflow mau (template, khong co gi de luu).
      if (isDirty) {
        await saveWorkflowDraft()
      }
      const response = await runWorkflow(draftWorkflow.id, {
        prompt: promptValue,
        image_url: referenceImageValue || undefined,
        video_url: videoUrlValue || undefined,
        audio_url: audioUrlValue || undefined,
        aspect_ratio: aspectRatioValue,
        duration: durationValue,
        tool_id: toolIdValue || undefined,
        output_mode: draftWorkflow.media === 'hybrid' ? runMode : undefined,
        target_node_id: targetNodeId || undefined,
        variables: dynamicVariables,
      })
      setRuns((current) => [response.run, ...current.filter((item) => item.id !== response.run.id)])
      // 2026-07-30: Sep bao "chay thanh cong nhung khong thay ket qua dau" - root cause: sau khi
      // chay xong, code chi them run moi vao dau danh sach "runs" nhung KHONG ghim lai
      // "selectedRunId" ve run vua chay. Neu truoc do dang xem 1 run CU (vi du 1 lan chay that bai
      // truoc, van con trong danh sach) thi effect trong useWorkflowHubRunState.ts se GIU NGUYEN
      // lua chon cu (chi doi selectedRunId khi run dang chon KHONG con trong danh sach nua) - khien
      // ca panel "Trinh xem luot chay" lan preview tren node "Tao anh"/"Tao video" tiep tuc doc du
      // lieu tu run cu (rong/that bai) thay vi run vua chay xong that su co anh/video. Ghim thang
      // ve run vua tao de nguoi dung thay ngay ket qua, kem theo dat lai node dau vet dang chon.
      setSelectedRunId(response.run.id)
      setSelectedTraceNodeId(targetNodeId || null)
      setError(null)
    } catch (runError) {
      window.alert(errorMessage(runError))
    } finally {
      setIsRunning(false)
    }
  }, [
    currentMode,
    currentNeedsReference,
    draftWorkflow,
    errorMessage,
    runInputValues,
    runMode,
    runVariablesJson,
    setError,
    setIsRunning,
    setRuns,
    setSelectedRunId,
    setSelectedTraceNodeId,
    validationIssueLines,
    workflowValidationErrors,
    isDirty,
    saveWorkflowDraft,
  ])

  return { runWorkflowAction }
}
