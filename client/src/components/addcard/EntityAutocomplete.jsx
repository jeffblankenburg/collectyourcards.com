import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import './EntityAutocomplete.css'

/**
 * EntityAutocomplete - Reusable autocomplete component for Add Card form
 *
 * Supports searching sets, series, players, teams, and colors with
 * debounced API calls, keyboard navigation, and "not found" handling.
 */
export default function EntityAutocomplete({
  entityType,
  value,
  onChange,
  filterParams = {},
  allowCreate = true,
  placeholder = 'Search...',
  disabled = false,
  required = false,
  label,
  minChars = 2
}) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Get the appropriate API endpoint for the entity type
  const getEndpoint = useCallback(() => {
    const endpoints = {
      set: '/api/v1/search/sets-autocomplete',
      series: '/api/v1/search/series-autocomplete',
      player: '/api/v1/search/players-autocomplete',
      team: '/api/v1/search/teams-autocomplete',
      color: '/api/v1/search/colors-autocomplete'
    }
    return endpoints[entityType] || endpoints.player
  }, [entityType])

  // Format display label for an option
  const getOptionLabel = useCallback((option) => {
    if (!option) return ''
    switch (entityType) {
      case 'set':
        return option.year ? `${option.name} (${option.year})` : option.name
      case 'series':
        return option.is_base ? `${option.name} (Base)` : option.name
      case 'player':
        return option.primary_team
          ? `${option.name} - ${option.primary_team.name}`
          : option.name
      case 'team':
        return option.abbreviation
          ? `${option.name} (${option.abbreviation})`
          : option.name
      case 'color':
        return option.name
      default:
        return option.name || option.label || ''
    }
  }, [entityType])

  // Perform search
  const performSearch = useCallback(async (searchTerm) => {
    if (searchTerm.length < minChars && entityType !== 'series' && entityType !== 'color') {
      setOptions([])
      return
    }

    setIsLoading(true)
    try {
      const params = { q: searchTerm, limit: 10, ...filterParams }
      const response = await axios.get(getEndpoint(), { params })

      if (response.data.success) {
        setOptions(response.data.data || [])
      } else {
        setOptions([])
      }
    } catch (error) {
      console.error(`Error searching ${entityType}:`, error)
      setOptions([])
    } finally {
      setIsLoading(false)
    }
  }, [entityType, filterParams, getEndpoint, minChars])

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setHighlightedIndex(-1)

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set new timeout for search
    debounceRef.current = setTimeout(() => {
      performSearch(newValue)
    }, 300)

    // Open dropdown when typing
    if (!isOpen) {
      setIsOpen(true)
    }

    // Clear selection if input is cleared
    if (!newValue && value) {
      onChange(null)
    }
  }

  // Handle option selection
  const handleSelect = (option) => {
    const label = getOptionLabel(option)
    setInputValue(label.split(' - ')[0]) // Remove team suffix for players
    onChange(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.blur()
  }

  // Handle "not found" selection
  const handleCreateNew = () => {
    onChange({
      _isNew: true,
      _rawValue: inputValue,
      name: inputValue
    })
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    const totalOptions = options.length + (allowCreate && inputValue.length >= minChars ? 1 : 0)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < totalOptions - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : totalOptions - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0) {
          if (highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex])
          } else if (allowCreate) {
            handleCreateNew()
          }
        } else if (options.length === 1) {
          handleSelect(options[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  // Handle focus
  const handleFocus = () => {
    updateDropdownPosition()
    if (inputValue.length >= minChars || entityType === 'series' || entityType === 'color') {
      setIsOpen(true)
      if (options.length === 0) {
        performSearch(inputValue)
      }
    }
  }

  // Update dropdown position for portal
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [])

  // Update position on scroll/resize
  useEffect(() => {
    if (isOpen) {
      const handlePositionUpdate = () => updateDropdownPosition()
      window.addEventListener('scroll', handlePositionUpdate, true)
      window.addEventListener('resize', handlePositionUpdate)
      return () => {
        window.removeEventListener('scroll', handlePositionUpdate, true)
        window.removeEventListener('resize', handlePositionUpdate)
      }
    }
  }, [isOpen, updateDropdownPosition])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync input value with external value
  useEffect(() => {
    if (value) {
      if (value._isNew) {
        setInputValue(value._rawValue || value.name || '')
      } else {
        const label = getOptionLabel(value)
        setInputValue(label.split(' - ')[0]) // Remove team suffix for players
      }
    } else {
      setInputValue('')
    }
  }, [value, getOptionLabel])

  // Load series when set_id changes (for series type)
  useEffect(() => {
    if (entityType === 'series' && filterParams.set_id) {
      performSearch('')
    }
  }, [entityType, filterParams.set_id, performSearch])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const showCreateOption = allowCreate &&
    inputValue.length >= minChars &&
    !options.some(opt => getOptionLabel(opt).toLowerCase() === inputValue.toLowerCase())

  const renderDropdown = () => {
    if (!isOpen) return null

    const content = (
      <div
        ref={dropdownRef}
        className="entity-autocomplete-dropdown"
        style={{
          position: 'absolute',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: 9999
        }}
      >
        {isLoading ? (
          <div className="entity-autocomplete-loading">
            <span className="loading-spinner"></span>
            Searching...
          </div>
        ) : (
          <>
            {options.length > 0 ? (
              <div className="entity-autocomplete-options">
                {options.map((option, index) => {
                  const id = option.set_id || option.series_id || option.player_id ||
                             option.team_id || option.color_id || index
                  return (
                    <div
                      key={id}
                      className={`entity-autocomplete-option ${
                        highlightedIndex === index ? 'highlighted' : ''
                      } ${value && (
                        value.set_id === option.set_id ||
                        value.series_id === option.series_id ||
                        value.player_id === option.player_id ||
                        value.team_id === option.team_id ||
                        value.color_id === option.color_id
                      ) ? 'selected' : ''}`}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="option-content">
                        <span className="option-label">{getOptionLabel(option)}</span>
                        {entityType === 'set' && option.manufacturer && (
                          <span className="option-secondary">{option.manufacturer}</span>
                        )}
                        {entityType === 'series' && option.print_run && (
                          <span className="option-secondary">/{option.print_run}</span>
                        )}
                        {entityType === 'player' && option.card_count > 0 && (
                          <span className="option-secondary">{option.card_count} cards</span>
                        )}
                      </div>
                      {option.is_base && (
                        <span className="option-badge">Base</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : inputValue.length >= minChars ? (
              <div className="entity-autocomplete-empty">
                No {entityType}s found matching "{inputValue}"
              </div>
            ) : (
              <div className="entity-autocomplete-hint">
                Type at least {minChars} characters to search
              </div>
            )}

            {showCreateOption && (
              <div
                className={`entity-autocomplete-create ${
                  highlightedIndex === options.length ? 'highlighted' : ''
                }`}
                onClick={handleCreateNew}
                onMouseEnter={() => setHighlightedIndex(options.length)}
              >
                <span className="create-icon">+</span>
                <span className="create-text">
                  Create new: <strong>"{inputValue}"</strong>
                </span>
                <span className="create-badge">Pending Review</span>
              </div>
            )}
          </>
        )}
      </div>
    )

    return createPortal(content, document.body)
  }

  return (
    <div
      ref={containerRef}
      className={`entity-autocomplete ${disabled ? 'disabled' : ''}`}
    >
      {label && (
        <label className="entity-autocomplete-label">
          {label}
          {required && <span className="required-star">*</span>}
        </label>
      )}
      <div className="entity-autocomplete-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`entity-autocomplete-input ${isOpen ? 'open' : ''} ${value?._isNew ? 'is-new' : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {value && !value._isNew && (
          <span className="input-status resolved">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        )}
        {value?._isNew && (
          <span className="input-status new">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </span>
        )}
        {isLoading && (
          <span className="input-status loading">
            <span className="loading-spinner-small"></span>
          </span>
        )}
      </div>
      {renderDropdown()}
    </div>
  )
}
