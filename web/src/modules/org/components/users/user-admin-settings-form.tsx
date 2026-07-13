'use client'

import { useState } from 'react'
import { Button, Chip, Input, Select, SelectItem, Switch, addToast } from '@heroui/react'
import { useRouter } from 'next/navigation'
import type { UserWithDepartment } from '@/modules/org/users/repo'
import {
  sendUserInvites,
  updateUserAdminSettings,
} from '@/modules/org/users/actions'
import {
  defaultSystemRole,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLE_OPTIONS,
  type SystemRoleValue,
} from '@/constants/system-roles'
import { showErrorToast, showResultError } from '@/core/client/errors'

export default function UserAdminSettingsForm({ user }: { user: UserWithDepartment }) {
  const router = useRouter()
  const [role, setRole] = useState<SystemRoleValue>(defaultSystemRole(user.role))
  const [tags, setTags] = useState(user.tags ?? '')
  const [isActive, setIsActive] = useState(user.is_active)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingInvite, setIsSendingInvite] = useState(false)

  const save = async () => {
    setIsSaving(true)
    try {
      const result = await updateUserAdminSettings({
        id: user.id,
        role,
        tags,
        is_active: isActive,
      })
      if (!result.success) {
        showResultError(result, '保存失败')
        return
      }
      addToast({ title: '用户设置已保存', color: 'success', timeout: 1600 })
      router.push('/admin/users')
      router.refresh()
    } catch (error) {
      showErrorToast({ title: '保存失败', error })
    } finally {
      setIsSaving(false)
    }
  }

  const canSendInvite = isActive && !user.invite_sent_at && !!user.email?.trim()

  const sendInvite = async () => {
    setIsSendingInvite(true)
    try {
      const result = await sendUserInvites({ ids: [user.id] })
      if (!result.success) {
        showResultError(result, '发送失败')
        return
      }
      addToast({
        title:
          result.data.sent_count > 0
            ? '邀请邮件已发送'
            : '没有发送邀请邮件',
        description:
          result.data.sent_count > 0
            ? undefined
            : '用户可能未生效、没有邮箱，或已发送过邀请',
        color: result.data.sent_count > 0 ? 'success' : 'warning',
        timeout: 2500,
      })
      router.refresh()
    } catch (error) {
      showErrorToast({ title: '发送失败', error })
    } finally {
      setIsSendingInvite(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-default-500 text-xs">工号</div>
          <div className="mt-1 text-sm">{user.employee_no ?? '-'}</div>
        </div>
        <div>
          <div className="text-default-500 text-xs">姓名</div>
          <div className="mt-1 text-sm">{user.name ?? '-'}</div>
        </div>
        <div>
          <div className="text-default-500 text-xs">部门</div>
          <div className="mt-1 text-sm">{user.department_name || '-'}</div>
        </div>
        <div>
          <div className="text-default-500 text-xs">邮箱</div>
          <div className="mt-1 text-sm">{user.email ?? '-'}</div>
        </div>
        <div>
          <div className="text-default-500 text-xs">职位</div>
          <div className="mt-1 text-sm">{user.position ?? '-'}</div>
        </div>
        <div>
          <div className="text-default-500 text-xs">OA 部门领导</div>
          <div className="mt-1">
            <Chip size="sm" color={user.is_dept_leader ? 'primary' : 'default'} variant="flat">
              {user.is_dept_leader ? '是' : '否'}
            </Chip>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="系统角色"
          selectedKeys={new Set([role])}
          onSelectionChange={(keys) => {
            if (keys === 'all') return
            const next = Array.from(keys)[0] as SystemRoleValue | undefined
            if (next) setRole(next)
          }}
        >
          {SYSTEM_ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Input label="标签" value={tags} onValueChange={setTags} placeholder="填写用户标签" />
      </div>

      <Switch isSelected={isActive} onValueChange={setIsActive}>
        {isActive ? '已生效' : '未生效'}
      </Switch>

      <div className="rounded-xl border border-default-200 bg-default-50 p-4 dark:bg-default-100/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">邀请邮件</div>
            <div className="mt-1 text-xs text-default-500">
              {user.invite_sent_at
                ? `已发送：${new Date(user.invite_sent_at).toLocaleString('zh-CN')}`
                : '尚未发送邀请邮件'}
            </div>
          </div>
          <Button
            size="sm"
            variant="flat"
            color="primary"
            isLoading={isSendingInvite}
            isDisabled={!canSendInvite || isSaving}
            onPress={() => void sendInvite()}
          >
            发送邀请邮件
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="flat" onPress={() => router.push('/admin/users')} isDisabled={isSaving}>
          返回
        </Button>
        <Button color="primary" onPress={save} isLoading={isSaving}>
          保存
        </Button>
      </div>

      <div className="text-default-400 text-xs">
        当前角色：{SYSTEM_ROLE_LABEL[role]}
      </div>
    </div>
  )
}
