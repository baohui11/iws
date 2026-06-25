'use client'

import { Card, CardBody, CardHeader } from '@heroui/react'
import AvatarUpload from './avatar-upload'
import ProfileInfoFields from './info-fields'
import ProfilePasswordSection from './password-section'
import type { CurrentUser } from '@/core/auth'

interface ProfileSettingsProps {
  profile: CurrentUser
}

export default function ProfileSettings({ profile }: ProfileSettingsProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">个人设置</h1>
        <p className="text-default-500 text-small md:text-medium">
          查看个人资料与账号信息；头像可在此更换，其他信息如有误请联系管理员。
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Card shadow="sm" className="border-default-200/80 dark:border-default-100 border">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
            <h2 className="text-large font-medium">头像</h2>
            <p className="text-default-500 text-small">
              将显示在顶部导航等位置，支持常见图片格式。
            </p>
          </CardHeader>
          <CardBody className="px-6 pt-4 pb-6">
            <AvatarUpload initialSrc={profile.avatarUrl} name={profile.name} />
          </CardBody>
        </Card>

        <Card shadow="sm" className="border-default-200/80 dark:border-default-100 border">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
            <h2 className="text-large font-medium">基本信息</h2>
            <p className="text-default-500 text-small">仅供查看，如有误请联系管理员。</p>
          </CardHeader>
          <CardBody className="px-6 pt-4 pb-6">
            <ProfileInfoFields profile={profile} />
          </CardBody>
        </Card>

        <Card shadow="sm" className="border-default-200/80 dark:border-default-100 border">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-0">
            <h2 className="text-large font-medium">账号安全</h2>
            <p className="text-default-500 text-small">
              修改用于登录的密码；展开后输入新密码并确认。
            </p>
          </CardHeader>
          <CardBody className="px-6 pt-4 pb-6">
            <ProfilePasswordSection />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
