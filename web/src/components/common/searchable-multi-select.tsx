'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollShadow,
} from '@heroui/react'
import { Icon } from '@iconify/react'

export interface SearchableMultiSelectItem {
  key: string
  searchText: string
  children: React.ReactNode
}

interface SearchableMultiSelectProps {
  label?: string
  items: SearchableMultiSelectItem[]
  selectedKeys: Set<string>
  onSelectionChange: (keys: Set<string>) => void
  allLabel?: string
  placeholder?: string
  ariaLabel?: string
  className?: string
  isDisabled?: boolean
}

export default function SearchableMultiSelect({
  label,
  items,
  selectedKeys,
  onSelectionChange,
  allLabel = '全部',
  placeholder = '输入筛选…',
  ariaLabel,
  className,
  isDisabled,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.searchText.toLowerCase().includes(q))
  }, [items, query])

  const summary = selectedKeys.size === 0 ? allLabel : `已选 ${selectedKeys.size} 项`

  const setKey = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys)
    if (checked) next.add(key)
    else next.delete(key)
    onSelectionChange(next)
  }

  return (
    <div className={className}>
      {label ? (
        <span className="mb-1.5 block text-sm text-foreground">{label}</span>
      ) : null}
      <Popover
        isOpen={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        classNames={{ content: 'p-0' }}
      >
        <PopoverTrigger>
          <Button
            variant="bordered"
            size="sm"
            className="h-10 min-h-10 min-w-[200px] max-w-[260px] justify-between border-default-200 px-3 font-normal"
            endContent={
              <Icon icon="lucide:chevron-down" className="size-4 shrink-0 opacity-60" />
            }
            isDisabled={isDisabled}
            aria-label={ariaLabel}
          >
            <span className="truncate text-left text-sm text-foreground">
              {summary}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,320px)] p-3">
          <div className="flex w-full flex-col gap-2">
            <Input
              size="sm"
              variant="bordered"
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
              startContent={
                <Icon icon="lucide:search" className="size-4 text-default-400" />
              }
              classNames={{ inputWrapper: 'h-9' }}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="light" onPress={() => onSelectionChange(new Set())}>
                清空选择
              </Button>
            </div>
            <ScrollShadow className="max-h-56">
              <div className="flex flex-col gap-0.5">
                {filtered.length === 0 ? (
                  <p className="py-2 text-center text-xs text-default-400">
                    无匹配项
                  </p>
                ) : (
                  filtered.map((it) => (
                    <Checkbox
                      key={it.key}
                      size="sm"
                      isSelected={selectedKeys.has(it.key)}
                      onValueChange={(checked) => setKey(it.key, checked)}
                      classNames={{ label: 'w-full' }}
                    >
                      <span className="text-sm">{it.children}</span>
                    </Checkbox>
                  ))
                )}
              </div>
            </ScrollShadow>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
