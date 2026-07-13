function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buttonTemplate(input: {
  title: string
  intro: string
  buttonText: string
  url: string
  footer: string
}) {
  const safeUrl = escapeHtml(input.url)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body>
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px;">
      ${escapeHtml(input.title)}
    </h2>
    <p>尊敬的用户，您好！</p>
    <p>${escapeHtml(input.intro)}</p>
    <p style="text-align: center; margin: 25px 0;">
      <a href="${safeUrl}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
        ${escapeHtml(input.buttonText)}
      </a>
    </p>
    <p style="color: #888; font-size: 13px; margin-top: 20px;">
      ${escapeHtml(input.footer)}
    </p>
    <p style="color: #888; font-size: 13px; word-break: break-all;">
      如果按钮无法打开，请复制此链接到浏览器：<br />${safeUrl}
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
    <p style="color: #999; font-size: 12px; text-align: center;">
      此邮件由中大咨询周报系统自动发送，请勿直接回复。
    </p>
  </div>
</body>
</html>`
}

export function renderPasswordResetEmail(url: string) {
  return buttonTemplate({
    title: '周报文件系统 - 密码重置请求',
    intro: '我们收到了您重置密码的请求。请点击下面的按钮来设置您的新密码：',
    buttonText: '重置密码',
    url,
    footer: '此链接将在 24 小时后失效。如果您没有请求重置密码，请忽略此邮件。',
  })
}

export function renderInviteEmail(url: string) {
  return buttonTemplate({
    title: '周报文件系统 - 您收到了一个邀请',
    intro: '您已被邀请加入周报文件系统。请点击下面的按钮完成账号设置：',
    buttonText: '接受邀请',
    url,
    footer: '此链接将在 24 小时后失效。如果您没有申请过邀请，请忽略此邮件。',
  })
}
