import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { canAccessAdminNav } from "@/lib/auth/nav-access";
import { getSessionProfile } from "@/lib/db/auth/profile";

/** 登录由 proxy 校验；此处仅角色：admin / dept_admin */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  if (!canAccessAdminNav(profile.role)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
