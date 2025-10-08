import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './Lists.css'

function Lists() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()

  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [editingListId, setEditingListId] = useState(null)
  const [editListName, setEditListName] = useState('')
  const [deletingListId, setDeletingListId] = useState(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadLists()
  }, [user, navigate])

  const loadLists = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/user/lists')
      setLists(response.data.lists || [])
    } catch (error) {
      console.error('Error loading lists:', error)
      addToast('Failed to load lists', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      addToast('Please enter a list name', 'error')
      return
    }

    try {
      setCreatingList(true)
      const response = await axios.post('/api/user/lists', {
        name: newListName.trim()
      })

      const newList = response.data.list
      setLists([newList, ...lists])
      setNewListName('')
      setShowNewListInput(false)
      addToast('List created successfully', 'success')
    } catch (error) {
      console.error('Error creating list:', error)
      addToast(error.response?.data?.message || 'Failed to create list', 'error')
    } finally {
      setCreatingList(false)
    }
  }

  const handleStartEdit = (list) => {
    setEditingListId(list.user_list_id)
    setEditListName(list.name)
  }

  const handleCancelEdit = () => {
    setEditingListId(null)
    setEditListName('')
  }

  const handleSaveEdit = async (list) => {
    if (!editListName.trim()) {
      addToast('List name cannot be empty', 'error')
      return
    }

    try {
      const response = await axios.put(`/api/user/lists/${list.slug}`, {
        name: editListName.trim()
      })

      const updatedList = response.data.list
      setLists(lists.map(l =>
        l.user_list_id === list.user_list_id ? updatedList : l
      ))
      setEditingListId(null)
      setEditListName('')
      addToast('List updated successfully', 'success')
    } catch (error) {
      console.error('Error updating list:', error)
      addToast(error.response?.data?.message || 'Failed to update list', 'error')
    }
  }

  const handleDeleteList = async (list) => {
    if (!window.confirm('Are you sure you want to delete this list? All cards will be removed from it.')) {
      return
    }

    try {
      setDeletingListId(list.user_list_id)
      await axios.delete(`/api/user/lists/${list.slug}`)

      setLists(lists.filter(l => l.user_list_id !== list.user_list_id))
      addToast('List deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting list:', error)
      addToast(error.response?.data?.message || 'Failed to delete list', 'error')
    } finally {
      setDeletingListId(null)
    }
  }

  const handleViewList = (list) => {
    navigate(`/lists/${list.slug}`)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="lists-page">
        <div className="lists-container">
          <div className="loading-spinner">
            <div className="card-icon-spinner"></div>
            <p>Loading your lists...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lists-page">
      <div className="lists-container">
        <div className="lists-header">
          <div className="lists-header-content">
            <h1>
              <Icon name="list" size={32} />
              My Lists
            </h1>
            <p className="lists-subtitle">
              Organize your cards into custom collections
            </p>
          </div>
          <button
            className="create-list-button"
            onClick={() => setShowNewListInput(true)}
            disabled={showNewListInput}
          >
            <Icon name="plus" size={20} />
            Create New List
          </button>
        </div>

        {showNewListInput && (
          <div className="new-list-form">
            <input
              type="text"
              placeholder="Enter list name..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateList()}
              autoFocus
              disabled={creatingList}
            />
            <button
              className="confirm-button"
              onClick={handleCreateList}
              disabled={creatingList || !newListName.trim()}
            >
              {creatingList ? (
                <div className="card-icon-spinner small"></div>
              ) : (
                <Icon name="check" size={20} />
              )}
            </button>
            <button
              className="cancel-button"
              onClick={() => {
                setShowNewListInput(false)
                setNewListName('')
              }}
              disabled={creatingList}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
        )}

        {lists.length === 0 ? (
          <div className="empty-state">
            <Icon name="list" size={64} />
            <h2>No lists yet</h2>
            <p>Create your first list to start organizing your card collection</p>
            <button
              className="create-first-list-button"
              onClick={() => setShowNewListInput(true)}
            >
              <Icon name="plus" size={20} />
              Create Your First List
            </button>
          </div>
        ) : (
          <div className="lists-grid">
            {lists.map(list => (
              <div key={list.user_list_id} className="list-card">
                {editingListId === list.user_list_id ? (
                  <div className="list-edit-form">
                    <input
                      type="text"
                      value={editListName}
                      onChange={(e) => setEditListName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(list)}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button
                        className="save-button"
                        onClick={() => handleSaveEdit(list)}
                      >
                        <Icon name="check" size={16} />
                      </button>
                      <button
                        className="cancel-edit-button"
                        onClick={handleCancelEdit}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="list-card-header" onClick={() => handleViewList(list)}>
                      <h3>{list.name}</h3>
                      <div className="list-card-count">
                        {list.card_count} {list.card_count === 1 ? 'card' : 'cards'}
                      </div>
                    </div>
                    <div className="list-card-footer">
                      <div className="list-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleStartEdit(list)}
                          title="Rename list"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteList(list)}
                          disabled={deletingListId === list.user_list_id}
                          title="Delete list"
                        >
                          {deletingListId === list.user_list_id ? (
                            <div className="card-icon-spinner tiny"></div>
                          ) : (
                            <Icon name="trash" size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Lists
