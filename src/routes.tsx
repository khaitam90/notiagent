import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './Layout'
import StudioHubPage from './pages/StudioHubPage'
import StudioPage from './pages/StudioPage'
import { fetchFreezeStatus, type FreezeStatus } from './lib/freezeMode'
import { useI18n } from './lib/i18n'

const STUDIO_HOME = '/studio'

function FreezeRedirect() {
  return <Navigate to={STUDIO_HOME} replace />
}

function StudioRoutes({ freeze }: { freeze: FreezeStatus | null }) {
  const { t } = useI18n()
  const layoutFreeze: FreezeStatus = freeze ?? {
    active: true,
    mode: 'studio_full',
    message: t('routes.freeze.stable'),
    allowed_features: ['studio'],
    unlock_command: '/mokhoa',
  }
  return (
    <Routes>
      <Route element={<Layout freeze={layoutFreeze} />}>
        <Route index element={<Navigate to={STUDIO_HOME} replace />} />
        <Route path="studio" element={<StudioHubPage />} />
        <Route path="studio/editor" element={<StudioPage />} />
        <Route path="*" element={<FreezeRedirect />} />
      </Route>
    </Routes>
  )
}

export default function AppRoutes() {
  const { t } = useI18n()
  const [freeze, setFreeze] = useState<FreezeStatus | null>(null)

  useEffect(() => {
    void fetchFreezeStatus().then(setFreeze).catch(() => {
      setFreeze({
        active: true,
        mode: 'studio_full',
        message: t('routes.freeze.simple'),
        allowed_features: ['studio'],
        unlock_command: '/mokhoa',
      })
    })
  }, [t])

  if (freeze === null) {
    return <div className="app-loading">{t('routes.loadingStudio')}</div>
  }

  return <StudioRoutes freeze={freeze} />
}
