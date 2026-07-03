'use client'

import { Autocomplete, AutocompleteItem } from '@heroui/react'
import type { Key, ReactNode } from 'react'

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
}

const EMPTY_KEY = '__empty__'

function keyToString(key: Key | null): string {
  if (key == null || String(key) === EMPTY_KEY) return ''
  return String(key)
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
}: SearchableSelectProps) {
  const items = emptyOptionLabel
    ? [
        {
          key: EMPTY_KEY,
          label: emptyOptionLabel,
          searchText: emptyOptionLabel,
        },
        ...options,
      ]
    : options
  const selectedKey = value || (emptyOptionLabel ? EMPTY_KEY : null)

  return (
    <Autocomplete
      allowsCustomValue={false}
      className={className}
      defaultItems={items}
      description={description}
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      isRequired={isRequired}
      label={label}
      placeholder={placeholder}
      selectedKey={selectedKey}
      size={size}
      variant={variant}
      onSelectionChange={(key) => onChange?.(keyToString(key))}
    >
      {(item) => (
        <AutocompleteItem key={item.key} textValue={item.searchText ?? item.label}>
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
