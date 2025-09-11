import React, { useState, useRef, useEffect } from 'react'
import Icon from './Icon'

const EllipsesMenu = ({ items = [], className = "" }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTriggerClick = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleItemClick = (item) => {
    item.onClick?.()
    setIsOpen(false)
  }

  return (
    <div ref={menuRef} className={`ellipses-menu ${isOpen ? 'open' : ''} ${className}`}>
      <button
        className="ellipses-trigger"
        onClick={handleTriggerClick}
        type="button"
        aria-label="More options"
      >
        <Icon name="more-horizontal" size={20} />
      </button>
      
      <div className="ellipses-dropdown">
        {items.map((item, index) => (
          <button
            key={index}
            className={`ellipses-item ${item.danger ? 'danger' : ''}`}
            onClick={() => handleItemClick(item)}
            type="button"
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default EllipsesMenu