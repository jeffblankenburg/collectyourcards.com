import React, { useState, useEffect, useRef } from 'react'

const CustomSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Choose an option...",
  searchable = true,
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [filteredOptions, setFilteredOptions] = useState(options)
  const [hasFocus, setHasFocus] = useState(false)
  
  const selectRef = useRef(null)
  const inputRef = useRef(null)
  const optionsRef = useRef(null)

  // Set initial input value when value prop changes
  useEffect(() => {
    const selectedOption = options.find(option => option.value === value)
    if (selectedOption && !hasFocus) {
      setInputValue(selectedOption.label)
    } else if (!value && !hasFocus) {
      setInputValue('')
    }
  }, [value, options, hasFocus])

  // Filter options based on input value
  useEffect(() => {
    if (!inputValue || !isOpen) {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option => 
        option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        (option.value && option.value.toString().toLowerCase().includes(inputValue.toLowerCase()))
      )
      setFilteredOptions(filtered)
    }
    setHighlightedIndex(-1)
  }, [inputValue, options, isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        handleBlur()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBlur = () => {
    setIsOpen(false)
    setHasFocus(false)
    
    // Reset input to selected value or clear it
    const selectedOption = options.find(option => option.value === value)
    if (selectedOption) {
      setInputValue(selectedOption.label)
    } else {
      setInputValue('')
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          )
          break
        case 'Enter':
          event.preventDefault()
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleOptionClick(filteredOptions[highlightedIndex])
          }
          break
        case 'Escape':
          handleBlur()
          inputRef.current?.blur()
          break
        default:
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, highlightedIndex, filteredOptions])

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionsRef.current) {
      const highlightedElement = optionsRef.current.children[highlightedIndex]
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ 
          block: 'nearest', 
          behavior: 'smooth' 
        })
      }
    }
  }, [highlightedIndex])

  const handleInputFocus = () => {
    setHasFocus(true)
    setIsOpen(true)
  }

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleOptionClick = (option) => {
    if (option.disabled) return
    onChange?.(option.value)
    setInputValue(option.label)
    setIsOpen(false)
    setHasFocus(false)
    setHighlightedIndex(-1)
    inputRef.current?.blur()
  }

  const handleArrowClick = () => {
    if (disabled) return
    if (isOpen) {
      handleBlur()
    } else {
      inputRef.current?.focus()
    }
  }

  return (
    <div 
      ref={selectRef}
      className={`custom-select ${isOpen ? 'open' : ''} ${className}`}
    >
      {/* Input Field */}
      <div className="custom-select-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`custom-select-input ${!inputValue && !hasFocus ? 'placeholder' : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={() => {
            // Delay blur to allow option clicks
            setTimeout(handleBlur, 150)
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={disabled}
        />
        <div 
          className="custom-select-arrow"
          onClick={handleArrowClick}
          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      <div className="custom-select-dropdown">        
        <div className="custom-select-options" ref={optionsRef} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                className={`custom-select-option ${
                  option.value === value ? 'selected' : ''
                } ${
                  index === highlightedIndex ? 'highlighted' : ''
                } ${
                  option.disabled ? 'disabled' : ''
                }`}
                onClick={() => handleOptionClick(option)}
                onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="custom-select-no-results">
              No results found for "{inputValue}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomSelect