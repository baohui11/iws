'use client'

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useState } from 'react'

type SearchMode = 'hybrid' | 'keyword' | 'semantic' | 'metadata'

const searchModes: { value: SearchMode; label: string; icon: string }[] = [
  { value: 'hybrid', label: '综合', icon: 'lucide:layers-3' },
  { value: 'keyword', label: '关键词', icon: 'lucide:text-search' },
  { value: 'semantic', label: '语义', icon: 'lucide:sparkles' },
  { value: 'metadata', label: '文件信息', icon: 'lucide:tag' },
]

export default function HomeSearchBox() {
  const [mode, setMode] = useState<SearchMode>('hybrid')
  const current =
    searchModes.find((item) => item.value === mode) ?? searchModes[0]

  return (
    <form
      action="/files/search"
      className="mt-8 flex min-h-14 items-center gap-2 rounded-2xl border border-default-200 bg-content1 px-2.5 py-2 shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
    >
      <input type="hidden" name="mode" value={mode} />
      <div className="flex h-8 shrink-0 items-center gap-2 pr-2">
        <Dropdown placement="bottom-start">
          <DropdownTrigger>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-default-700 outline-none transition hover:bg-default-100 hover:text-foreground"
            >
              <Icon
                icon={current.icon}
                className="size-4 text-default-500"
                aria-hidden
              />
              <span className="whitespace-nowrap">{current.label}</span>
              <Icon
                icon="lucide:chevron-down"
                className="size-3.5 text-default-400"
                aria-hidden
              />
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="检索模式"
            selectedKeys={new Set([mode])}
            selectionMode="single"
            onAction={(key) => setMode(String(key) as SearchMode)}
          >
            {searchModes.map((item) => (
              <DropdownItem
                key={item.value}
                startContent={
                  <Icon icon={item.icon} className="size-4" aria-hidden />
                }
              >
                {item.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <span className="h-6 w-px bg-default-200" aria-hidden />
      </div>

      <input
        name="q"
        type="search"
        placeholder="搜索文件名、项目、正文关键词"
        className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-default-400"
      />
      <Button
        type="submit"
        color="primary"
        radius="lg"
        className="h-10 shrink-0 px-5 font-medium"
      >
        搜索
      </Button>
    </form>
  )
}
