import type { Metadata } from "next";
import AuthErrorCard from "@/components/auth/auth-error-card";

export const metadata: Metadata = {
  title: "链接无效或已过期",
};

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <AuthErrorCard />
    </div>
  );
}
