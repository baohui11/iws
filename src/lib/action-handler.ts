import {
  AuthError,
  BusinessError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function handleAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof NotFoundError) {
      return { success: false, message: e.message };
    }

    if (e instanceof AuthError) {
      console.warn("[AuthError]", e.message);
      return { success: false, message: e.message };
    }

    if (e instanceof BusinessError) {
      console.warn("[BusinessError]", e.message);
      return { success: false, message: e.message };
    }

    console.error("[UnexpectedError]", e);
    return { success: false, message: "操作失败，请稍后重试" };
  }
}
