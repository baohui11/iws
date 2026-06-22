"use client";

import type { InputProps } from "@heroui/react";

import React from "react";
import { Button, Input, Form } from "@heroui/react";
import { Icon, addCollection } from "@iconify/react";
import solarIcons from "@iconify-json/solar/icons.json";
import { useRouter, useSearchParams } from "next/navigation";

addCollection(solarIcons as Parameters<typeof addCollection>[0]);

import { forgotPassword } from "@/actions/auth/forgot-password";
import { signIn } from "@/actions/auth/sign-in";

export default function LoginForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRedirect = searchParams.get("redirect") || "/";
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleForgotPassword = async () => {
    const email = (document.querySelector('input[name="email"]') as HTMLInputElement)?.value;
    if (!email) {
      setError("请先输入邮箱地址");
      return;
    }
    setError("");
    setIsSuccess(false);
    setForgotLoading(true);
    try {
      const result = await forgotPassword({ email });
      if (result.success) {
        setIsSuccess(true);
        setError("重置密码邮件已发送，请查收邮箱");
      } else {
        setError(result.message || "发送失败，请重试");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setForgotLoading(false);
    }
  };

  const inputClasses: InputProps["classNames"] = {
    inputWrapper:
      "border-default-200/60 dark:border-default-600/40 bg-white dark:bg-default-100 group-data-[focus=true]:border-primary data-[hover=true]:border-default-300",
  };

  const buttonClasses = "w-full bg-foreground/10 dark:bg-foreground/20";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSuccess(false);
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      if (!email || !password) {
        setError("请输入邮箱和密码");
        setIsLoading(false);
        return;
      }

      const result = await signIn({ email, password });

      if (!result.success) {
        setError(result.message || "登录失败");
        setIsLoading(false);
        return;
      }

      router.refresh();
      router.push(redirect || urlRedirect);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-large bg-background/60 shadow-small dark:bg-default-100/50 flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10 backdrop-blur-md backdrop-saturate-150 -mt-12">
      <p className="pb-2 text-xl font-medium">登 录</p>

      <Form
        className="flex flex-col gap-3"
        validationBehavior="native"
        onSubmit={handleSubmit}
      >
        {/* 消息提示 */}
        {error && (
          <div className={`rounded-medium border px-3 py-2 text-sm ${
            isSuccess
              ? "bg-success-50 text-success-700 border-success/20"
              : "bg-danger-50 text-danger border-danger/20"
          }`}>
            <Icon
              className="inline mr-1"
              icon={isSuccess ? "solar:check-circle-bold" : "solar:danger-circle-bold"}
            />
            {error}
          </div>
        )}

        {/* 邮箱输入 */}
        <Input
          isRequired
          autoComplete="email"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="email"
          placeholder="请输入企业邮箱"
          errorMessage="请输入企业邮箱"
          startContent={
            <Icon
              className="text-foreground/50 text-xl"
              icon="solar:letter-linear"
            />
          }
          type="email"
          variant="bordered"
        />

        {/* 密码输入 */}
        <Input
          isRequired
          autoComplete="current-password"
          classNames={inputClasses}
          errorMessage="请输入密码"
          endContent={
            <button
              aria-label="切换密码可见性"
              className="focus:outline-none"
              disabled={isLoading}
              type="button"
              onClick={toggleVisibility}
            >
              {isVisible ? (
                <Icon
                  className="text-foreground/50 text-2xl"
                  icon="solar:eye-closed-linear"
                />
              ) : (
                <Icon
                  className="text-foreground/50 text-2xl"
                  icon="solar:eye-bold"
                />
              )}
            </button>
          }
          isDisabled={isLoading}
          name="password"
          placeholder="请输入密码"
          startContent={
            <Icon
              className="text-foreground/50 text-xl"
              icon="solar:lock-password-linear"
            />
          }
          type={isVisible ? "text" : "password"}
          variant="bordered"
        />

        {/* 忘记密码 */}
        <Button
          type="button"
          variant="light"
          color="default"
          size="md"
          className="w-fit px-1 font-medium"
          isLoading={forgotLoading}
          isDisabled={isLoading}
          onPress={handleForgotPassword}
        >
          忘记密码?
        </Button>

        {/* 登录按钮 */}
        <Button className={buttonClasses} isLoading={isLoading} type="submit">
          {isLoading ? "登录中..." : "登  录"}
        </Button>
      </Form>
    </div>
  );
}
