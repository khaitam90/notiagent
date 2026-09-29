import { useCallback, useEffect, useState } from 'react'
import {
  ensureDefaultConnections,
  loadAgentSettings,
  saveAgentSettings,
  setActiveSkill,
  subscribeAgentSettings,
  toggleConnection,
  toggleSkill,
  type AgentSettings,
} from '../lib/agentSettings'
import { fetchAgentCapabilities, type AgentCapabilities } from '../lib/api'

export function useAgentCapabilities() {
  const [caps, setCaps] = useState<AgentCapabilities | null>(null)
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings)

  const reloadSettings = useCallback(() => setSettings(loadAgentSettings()), [])

  useEffect(() => {
    fetchAgentCapabilities().then((c) => {
      setCaps(c)
      const configured = c.connections.filter((x) => x.configured).map((x) => x.id)
      ensureDefaultConnections(configured)
      reloadSettings()
    }).catch(() => {})
  }, [reloadSettings])

  useEffect(() => subscribeAgentSettings(reloadSettings), [reloadSettings])

  const configuredConnections = caps?.connections.filter((c) => c.configured) ?? []

  const isConnectionOn = (id: string) => settings.enabledConnections.includes(id)
  const isSkillOn = (id: string) => settings.enabledSkills.includes(id)

  const flipConnection = (id: string) => {
    toggleConnection(id)
    reloadSettings()
  }

  const flipSkill = (id: string) => {
    toggleSkill(id)
    reloadSettings()
  }

  const pickSkill = (id: string) => {
    setActiveSkill(id)
    if (!settings.enabledSkills.includes(id)) toggleSkill(id, true)
    reloadSettings()
  }

  const updateSettings = (patch: Partial<AgentSettings>) => {
    const next = { ...loadAgentSettings(), ...patch }
    saveAgentSettings(next)
    reloadSettings()
  }

  return {
    caps,
    settings,
    configuredConnections,
    isConnectionOn,
    isSkillOn,
    flipConnection,
    flipSkill,
    pickSkill,
    updateSettings,
    activeSkill: caps?.skills.find((s) => s.id === settings.skillId),
  }
}
