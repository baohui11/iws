'use client'

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'

export interface ConfirmActionModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmText: string
  confirmColor?: 'primary' | 'danger' | 'warning'
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmText,
  confirmColor = 'primary',
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center">
      <ModalContent>
        <ModalHeader className="border-b border-default-200 px-6 py-4 text-base">
          {title}
        </ModalHeader>
        <ModalBody className="px-6 py-4">
          <p className="text-sm leading-6 text-default-600">{description}</p>
        </ModalBody>
        <ModalFooter className="border-t border-default-200">
          <Button variant="light" onPress={onClose} isDisabled={isLoading}>
            取消
          </Button>
          <Button
            color={confirmColor}
            isLoading={isLoading}
            onPress={onConfirm}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
