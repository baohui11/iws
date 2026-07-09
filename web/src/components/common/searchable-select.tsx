'use client'

import { Autocomplete, AutocompleteItem } from '@heroui/react'
import type { Key, ReactNode } from 'react'
import { useMemo, useState } from 'react'

export interface SearchableSelectOption {
  key: string
  label: string
  description?: string
  searchText?: string
  content?: ReactNode
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  emptyOptionLabel?: string
  label?: string
  isRequired?: boolean
  isDisabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  errorMessage?: string
  description?: string
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
  className?: string
  classNames?: {
    base?: string
    listboxWrapper?: string
    selectorButton?: string
    clearButton?: string
  }
  itemClassName?: string
}

const EMPTY_KEY = '__empty__'

function keyToString(key: Key | null): string {
  if (key == null || String(key) === EMPTY_KEY) return ''
  return String(key)
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '请选择',
  emptyOptionLabel,
  label,
  isRequired,
  isDisabled,
  size = 'md',
  errorMessage,
  description,
  variant = 'underlined',
  className,
  classNames,
  itemClassName,
}: SearchableSelectProps) {
  const items = useMemo(
    () =>
      emptyOptionLabel
        ? [
            {
              key: EMPTY_KEY,
              label: emptyOptionLabel,
              searchText: emptyOptionLabel,
            },
            ...options,
          ]
        : options,
    [emptyOptionLabel, options]
  )
  const selectedKey = value || (emptyOptionLabel ? EMPTY_KEY : null)
  const [inputValue, setInputValue] = useState('')
  const filteredItems = useMemo(() => {
    const query = normalizeSearchText(inputValue)
    if (!query) return items
    return items.filter((item) =>
      normalizeSearchText(`${item.label} ${item.searchText ?? ''}`).includes(query)
    )
  }, [inputValue, items])

  return (
    <Autocomplete
      allowsCustomValue={false}
      className={className}
      classNames={classNames}
      items={filteredItems}
      description={description}
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      isRequired={isRequired}
      label={label}
      placeholder={placeholder}
      selectedKey={selectedKey}
      size={size}
      variant={variant}
      onSelectionChange={(key) => {
        if (key == null) return
        onChange?.(keyToString(key))
      }}
      onInputChange={setInputValue}
    >
      {(item) => (
        <AutocompleteItem
          key={item.key}
          textValue={item.label}
          className={itemClassName}
        >
          {item.content ?? (
            <div className="flex flex-col">
              <span>{item.label}</span>
              {item.description ? (
                <span className="text-default-400 text-xs">{item.description}</span>
              ) : null}
            </div>
          )}
        </AutocompleteItem>
      )}
    </Autocomplete>
  )
}
