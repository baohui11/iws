"use client";

import { Input } from "@heroui/react";

import type { User } from "@/lib/db/auth/profile";
import { SYSTEM_ROLE_LABEL, defaultSystemRole } from "@/constants/system-roles";

function roleDisplayLabel(role: User["role"]): string {
  const key = defaultSystemRole(role);
  return SYSTEM_ROLE_LABEL[key];
}

interface ProfileInfoFieldsProps {
  profile: User;
}

export default function ProfileInfoFields({ profile }: ProfileInfoFieldsProps) {
  const roleLabel = roleDisplayLabel(profile.role);

  const inputClass = "col-span-12 md:col-span-6";

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-5">
      <Input
        className={inputClass}
        isReadOnly
        label="企业邮箱"
        value={profile.email || "—"}
        variant="underlined"
      />
      <Input
        className={inputClass}
        isReadOnly
        label="角色"
        value={roleLabel}
        variant="underlined"
      />
      <Input
        className={inputClass}
        isReadOnly
        label="姓名"
        value={profile.name || "—"}
        variant="underlined"
      />
      <Input
        className={inputClass}
        isReadOnly
        label="工号"
        value={profile.employee_no || "—"}
        variant="underlined"
      />
      <Input
        className={inputClass}
        isReadOnly
        label="性别"
        value={profile.gender || "—"}
        variant="underlined"
      />
      <Input
        className={inputClass}
        isReadOnly
        label="部门"
        value={profile.department_name?.trim() || "—"}
        variant="underlined"
      />
      <Input
        className="col-span-12 md:col-span-6"
        isReadOnly
        label="职位"
        value={profile.position || "—"}
        variant="underlined"
      />
    </div>
  );
}
