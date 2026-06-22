// hooks/useConfirm.ts
import { useState, useCallback } from 'react'

type ConfirmHandler = () => void | Promise<void>

export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean
    title: string
    description: string
    onConfirm: ConfirmHandler
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  })

  const confirm = useCallback(
    ({ title, description, onConfirm }: { title: string; description: string; onConfirm: ConfirmHandler }) => {
      setState({ isOpen: true, title, description, onConfirm })
    },
    []
  )

  const onClose = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }))
  }, [])

  return { confirm, modalProps: { ...state, onClose } }
}