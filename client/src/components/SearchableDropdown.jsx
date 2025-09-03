import React, { useState, useEffect, useRef } from 'react'
import Icon from './Icon'
import './SearchableDropdown.css'

function SearchableDropdown({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select option...", 
  emptyMessage = "No options available",
  getOptionLabel = (option) => option.label || option.name || String(option),
  getOptionValue = (option) => option.value || option.id || option,
  className = "",
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option => 
        getOptionLabel(option).toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredOptions(filtered)
    }
  }, [options, searchTerm, getOptionLabel])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const selectedOption = options.find(option => {
    const optionValue = getOptionValue(option)
    // Compare both as strings and as numbers to handle type mismatches
    return optionValue === value || 
           (optionValue != null && value != null && String(optionValue) === String(value))
  })
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : placeholder

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchTerm('')
      }
    }
  }

  const handleOptionSelect = (option) => {
    const optionValue = getOptionValue(option)
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  return (
    <div 
      className={`searchable-dropdown ${className} ${disabled ? 'disabled' : ''}`} 
      ref={dropdownRef}
    >
      <div 
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
      >
        <span className="dropdown-value">{displayValue}</span>
        <Icon 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          className="dropdown-arrow" 
        />
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-search">
            <Icon name="search" size={16} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="dropdown-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option)
                const optionLabel = getOptionLabel(option)
                // Compare both as strings and as numbers to handle type mismatches
                const isSelected = optionValue === value || 
                  (optionValue != null && value != null && String(optionValue) === String(value))

                return (
                  <div
                    key={`${optionValue}-${index}`}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(option)}
                  >
                    {optionLabel}
                    {isSelected && <Icon name="check" size={16} className="check-icon" />}
                  </div>
                )
              })
            ) : (
              <div className="dropdown-empty">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableDropdown