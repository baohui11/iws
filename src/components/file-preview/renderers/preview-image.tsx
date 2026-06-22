'use client'

export function PreviewImage({ signedUrl }: { signedUrl: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 预览签名 URL
    <img
      src={signedUrl}
      alt=""
      draggable={false}
      className="mx-auto block max-h-[min(80vh,900px)] max-w-full rounded-lg border border-default-200 object-contain"
    />
  )
}
