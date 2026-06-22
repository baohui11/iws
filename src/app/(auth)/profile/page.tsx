import ProfileSettings from "@/components/auth/profile/settings";
import { getDepartmentTree } from "@/lib/db/admin/departments";
import { getSessionProfile } from "@/lib/db/auth/profile";
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from "@/lib/utils/department-display";

/** 登录由 proxy 校验；此处拉取会话用户资料 */
export default async function ProfilePage() {
  const profile = await getSessionProfile();

  const trees = await getDepartmentTree();
  const flat = flattenDepartmentTree(trees);
  const departmentLabel = formatDepartmentPathLabel(
    profile.department_id,
    flat,
    profile.department_name,
  );

  return (
    <ProfileSettings
      profile={{ ...profile, department_name: departmentLabel }}
    />
  );
}
