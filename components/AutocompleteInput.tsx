'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { resolve } from '@/lib/theme'

export interface AutocompleteOption {
  label: string
  /** Dados extras associados à opção (ex: cache_dia, cache_semana) */
  data?: Record<string, unknown>
}

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  /** Chamada quando o usuário seleciona uma opção da lista */
  onSelect?: (option: AutocompleteOption) => void
  /** Função de busca assíncrona que retorna opções */
  search: (term: string) => Promise<AutocompleteOption[]>
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  /** Mínimo de caracteres para disparar a busca */
  minChars?: number
  /** Debounce em ms */
  debounce?: number
}

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  search,
  placeholder,
  className,
  style,
  minChars = 2,
  debounce = 300,
}: AutocompleteInputProps) {
  const [options, setOptions] = useState<AutocompleteOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Debounced search */
  const doSearch = useCallback(
    (term: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)

      if (!term || term.length < minChars) {
        setOptions([])
        setShowDropdown(false)
        return
      }

      timerRef.current = setTimeout(async () => {
        const results = await search(term)
        setOptions(results)
        setShowDropdown(results.length > 0)
        setActiveIndex(-1)
      }, debounce)
    },
    [search, minChars, debounce],
  )

  /* Fechar dropdown ao clicar fora */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* Cleanup timer */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    doSearch(val)
  }

  const handleSelect = (opt: AutocompleteOption) => {
    onChange(opt.label)
    setShowDropdown(false)
    setOptions([])
    onSelect?.(opt)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || options.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < options.length) {
        handleSelect(options[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (options.length > 0) setShowDropdown(true)
        }}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
      {showDropdown && options.length > 0 && (
        <div
          className="absolute left-0 right-0 z-[60] mt-0.5 rounded border shadow-lg overflow-y-auto"
          style={{
            backgroundColor: resolve.panel,
            borderColor: resolve.border,
            maxHeight: 200,
          }}
        >
          {options.map((opt, i) => (
            <div
              key={`${opt.label}-${i}`}
              className="px-2 py-1.5 text-sm cursor-pointer transition-colors"
              style={{
                backgroundColor: i === activeIndex ? resolve.accent : 'transparent',
                color: i === activeIndex ? resolve.bg : resolve.text,
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault() // Impede o blur do input
                handleSelect(opt)
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
