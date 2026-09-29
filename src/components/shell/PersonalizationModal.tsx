import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  loadPersonalization,
  savePersonalization,
  type KnowledgeItem,
  type Personalization,
  type PersonalizationProfile,
} from '../../lib/personalization'
import { generateId } from '../../lib/uuid'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'profile' | 'knowledge'

export function PersonalizationModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<PersonalizationProfile>(loadPersonalization().profile)
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(loadPersonalization().knowledge)
  const [tone, setTone] = useState<Personalization['tone']>(loadPersonalization().tone)
  const [newKnowledge, setNewKnowledge] = useState({ title: '', description: '' })

  useEffect(() => {
    if (!isOpen) return
    const data = loadPersonalization()
    setProfile(data.profile)
    setKnowledgeItems(data.knowledge)
    setTone(data.tone)
    setNewKnowledge({ title: '', description: '' })
    setActiveTab('profile')
  }, [isOpen])

  const handleAddKnowledge = () => {
    if (!newKnowledge.title.trim()) return
    setKnowledgeItems((items) => [
      ...items,
      { id: generateId(), title: newKnowledge.title.trim(), description: newKnowledge.description.trim() },
    ])
    setNewKnowledge({ title: '', description: '' })
  }

  const handleRemoveKnowledge = (id: string) => {
    setKnowledgeItems((items) => items.filter((item) => item.id !== id))
  }

  const save = () => {
    savePersonalization({ profile, knowledge: knowledgeItems, tone })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="pers-modal-root" role="dialog" aria-modal="true" aria-label="Cá nhân hóa">
      <button type="button" className="pers-modal-backdrop" aria-label="Đóng" onClick={onClose} />
      <div className="pers-modal">
        <header className="pers-modal-header">
          <h2>Cá nhân hóa</h2>
          <button type="button" className="pers-modal-close" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>

        <div className="pers-modal-tabs">
          <button
            type="button"
            className={activeTab === 'profile' ? 'active' : ''}
            onClick={() => setActiveTab('profile')}
          >
            Hộ sơ
          </button>
          <button
            type="button"
            className={activeTab === 'knowledge' ? 'active' : ''}
            onClick={() => setActiveTab('knowledge')}
          >
            Kiến thức
          </button>
        </div>

        <div className="pers-modal-body">
          {activeTab === 'profile' ? (
            <div className="pers-form">
              <label className="pers-field">
                <span>Tên của bạn</span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="pers-field">
                <span>Nghề nghiệp</span>
                <input
                  type="text"
                  value={profile.role}
                  onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))}
                />
              </label>
              <label className="pers-field">
                <span>Background</span>
                <textarea
                  value={profile.background}
                  onChange={(e) => setProfile((p) => ({ ...p, background: e.target.value }))}
                  rows={4}
                />
              </label>
              <label className="pers-field">
                <span>Quan tâm</span>
                <textarea
                  value={profile.interests}
                  onChange={(e) => setProfile((p) => ({ ...p, interests: e.target.value }))}
                  rows={4}
                />
              </label>
            </div>
          ) : (
            <div className="pers-knowledge">
              <div className="pers-knowledge-add">
                <h3>Thêm kiến thức mới</h3>
                <input
                  type="text"
                  placeholder="Tiêu đề"
                  value={newKnowledge.title}
                  onChange={(e) => setNewKnowledge((k) => ({ ...k, title: e.target.value }))}
                />
                <textarea
                  placeholder="Mô tả"
                  value={newKnowledge.description}
                  onChange={(e) => setNewKnowledge((k) => ({ ...k, description: e.target.value }))}
                  rows={3}
                />
                <button type="button" className="pers-btn-add" onClick={handleAddKnowledge}>
                  <Plus size={16} /> Thêm
                </button>
              </div>

              <div className="pers-knowledge-list">
                {knowledgeItems.map((item) => (
                  <article key={item.id} className="pers-knowledge-item">
                    <div>
                      <h4>{item.title}</h4>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <button
                      type="button"
                      className="pers-knowledge-remove"
                      onClick={() => handleRemoveKnowledge(item.id)}
                      aria-label={`Xóa ${item.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="pers-modal-footer">
          <button type="button" className="pers-btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="pers-btn-save" onClick={save}>
            Lưu
          </button>
        </footer>
      </div>
    </div>
  )
}
