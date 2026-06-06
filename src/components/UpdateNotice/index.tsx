import { useEffect, useState } from 'react'
import { Modal, Button, Space } from 'antd'

interface DownloadLink {
  label: string
  url: string
}

interface UpdateInfo {
  currentVersion: string
  remoteVersion: string
  downloadLinks: DownloadLink[]
}

export default function UpdateNotice() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    window.ipcRenderer.invoke('check-for-update').then((info: UpdateInfo | null) => {
      if (info) setUpdateInfo(info)
    })
  }, [])

  const handleClose = () => {
    setUpdateInfo(null)
  }

  const handleDownload = (url: string) => {
    window.ipcRenderer.invoke('open-external', url)
  }

  if (!updateInfo) return null

  return (
    <Modal
      title="发现新版本"
      open={true}
      onCancel={handleClose}
      footer={
        <Space>
          {updateInfo.downloadLinks.map((link) => (
            <Button
              key={link.url}
              type="primary"
              onClick={() => handleDownload(link.url)}
            >
              {link.label}
            </Button>
          ))}
          <Button onClick={handleClose}>忽略</Button>
        </Space>
      }
    >
      <p>当前版本：{updateInfo.currentVersion}</p>
      <p>最新版本：{updateInfo.remoteVersion}</p>
    </Modal>
  )
}
