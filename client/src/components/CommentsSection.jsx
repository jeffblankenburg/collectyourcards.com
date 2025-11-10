import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from './Icon'
import './CommentsSection.css'

const CommentsSection = ({ 
  itemType, // 'card', 'series', or 'set'
  itemId, 
  title = 'Discussion' 
}) => {
  const { isAuthenticated, user } = useAuth()
  const { addToast } = useToast()
  
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    fetchComments()
  }, [itemType, itemId])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/comments/${itemType}/${itemId}`)
      setComments(response.data.comments || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching comments:', err)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    
    // Clear any previous errors
    setCommentError('')
    
    if (!isAuthenticated) {
      addToast('Please sign in to post comments', 'error')
      return
    }

    if (!newComment.trim()) {
      setCommentError('Please enter a comment')
      return
    }

    try {
      setSubmitting(true)
      
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      const response = await axios.post(
        `/api/comments/${itemType}/${itemId}`, 
        { comment_text: newComment },
        config
      )
      
      if (response.data.comment) {
        setComments([response.data.comment, ...comments])
      } else {
        // Refetch if we didn't get the new comment back
        fetchComments()
      }
      
      setNewComment('')
      addToast('Comment posted successfully!', 'success')
      
    } catch (err) {
      console.error('Error posting comment:', err)
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to post comment'
      setCommentError(errorMessage)
      addToast(errorMessage, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) {
      addToast('Please enter a comment', 'error')
      return
    }

    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.put(
        `/api/comments/${commentId}`,
        { comment_text: editText },
        config
      )
      
      // Update the comment in the list
      setComments(comments.map(comment => 
        comment.comment_id === commentId 
          ? { ...comment, comment_text: editText, is_edited: true }
          : comment
      ))
      
      setEditingId(null)
      setEditText('')
      addToast('Comment updated successfully!', 'success')
      
    } catch (err) {
      console.error('Error editing comment:', err)
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update comment'
      addToast(errorMessage, 'error')
    }
  }

  const handleDeleteComment = (comment) => {
    setCommentToDelete(comment)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return

    try {
      setDeleting(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.delete(`/api/comments/${commentToDelete.comment_id}`, config)
      
      setComments(comments.filter(comment => comment.comment_id !== commentToDelete.comment_id))
      addToast('Comment deleted successfully!', 'success')
      
      // Close modal and reset state
      setShowDeleteConfirm(false)
      setCommentToDelete(null)
      
    } catch (err) {
      console.error('Error deleting comment:', err)
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to delete comment'
      addToast(errorMessage, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setCommentToDelete(null)
  }

  const startEdit = (comment) => {
    setEditingId(comment.comment_id)
    setEditText(comment.comment_text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const canEditComment = (comment) => {
    if (!isAuthenticated || !user) return false
    
    // User can edit their own comments
    if (Number(comment.user.user_id) === Number(user.userId)) {
      // Check if within 15-minute edit window
      const commentAge = Date.now() - new Date(comment.created_at).getTime()
      const fifteenMinutes = 15 * 60 * 1000
      return commentAge <= fifteenMinutes
    }
    
    return false
  }

  const canDeleteComment = (comment) => {
    if (!isAuthenticated || !user) return false
    
    // User can delete their own comments, admins can delete any
    const isOwner = Number(comment.user.user_id) === Number(user.userId)
    const isAdmin = user.role && ['admin', 'superadmin', 'data_admin'].includes(user.role)
    
    return isOwner || isAdmin
  }

  const formatTimeAgo = (dateString) => {
    const now = new Date()
    const commentDate = new Date(dateString)
    const diffInMs = now - commentDate
    const diffInMinutes = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInMinutes < 1) return 'just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return commentDate.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="comments-section">
        <div className="comments-header">
          <h3><Icon name="users" size={20} /> {title}</h3>
        </div>
        <div className="comments-loading">
          <div className="card-icon-spinner small"></div>
          <span>Loading comments...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="comments-section">
      <div className="comments-header">
        <h3>
          <Icon name="users" size={20} /> 
          {title} 
          {comments.length > 0 && (
            <span className="comments-count">({comments.length})</span>
          )}
        </h3>
      </div>

      {/* New Comment Form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmitComment} className="new-comment-form">
          <div className="comment-input-container">
            <textarea
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value)
                if (commentError) setCommentError('') // Clear error when user types
              }}
              placeholder={`Share your thoughts about this ${itemType}...`}
              rows={3}
              maxLength={5000}
              disabled={submitting}
              className="comment-textarea"
            />
            <div className="comment-form-footer">
              <div className="character-count">
                {newComment.length}/5000
              </div>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="submit-comment-btn"
              >
                {submitting ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Posting...
                  </>
                ) : (
                  'Post Comment'
                )}
              </button>
            </div>
          </div>
          {commentError && (
            <div className="comment-error-inline">
              <Icon name="alert-circle" size={16} />
              <span>{commentError}</span>
            </div>
          )}
        </form>
      ) : (
        <div className="auth-required">
          <Icon name="user" size={20} />
          <p>Please <a href="/login">sign in</a> to join the discussion</p>
        </div>
      )}

      {/* Comments List */}
      {error && (
        <div className="comments-error">
          <Icon name="alert-circle" size={20} />
          <span>{error}</span>
          <button onClick={fetchComments} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      {comments.length === 0 && !error && (
        <div className="no-comments">
          <Icon name="users" size={48} />
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      )}

      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment.comment_id} className="comment">
            <div className="comment-header">
              <div className="comment-author">
                {comment.user.avatar_url ? (
                  <img 
                    src={comment.user.avatar_url} 
                    alt={`${comment.user.username}'s avatar`}
                    className="author-avatar"
                  />
                ) : (
                  <Icon name="user" size={16} />
                )}
                <Link 
                  to={`/${comment.user.username}`} 
                  className="author-name-link"
                  title={`View ${comment.user.display_name || comment.user.username}'s profile`}
                >
                  <span className="author-name">
                    {comment.user.display_name || comment.user.username}
                  </span>
                  <span className="author-username">@{comment.user.username}</span>
                </Link>
              </div>
              <div className="comment-right">
                <div className="comment-meta">
                  <span className="comment-time">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                  {comment.is_edited && (
                    <span className="edited-indicator">(edited)</span>
                  )}
                </div>
                {/* Compact Action Buttons */}
                {isAuthenticated && editingId !== comment.comment_id && (
                  <div className="comment-actions-compact">
                    {canEditComment(comment) && (
                      <button
                        onClick={() => startEdit(comment)}
                        className="compact-action-btn edit-btn"
                        title="Edit comment (within 15 minutes)"
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    )}
                    {canDeleteComment(comment) && (
                      <button
                        onClick={() => handleDeleteComment(comment)}
                        className="compact-action-btn delete-btn"
                        title="Delete comment"
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="comment-content">
              {editingId === comment.comment_id ? (
                <div className="edit-comment-form">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    className="edit-textarea"
                  />
                  <div className="edit-form-footer">
                    <div className="character-count">
                      {editText.length}/5000
                    </div>
                    <div className="edit-buttons">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="cancel-edit-btn"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditComment(comment.comment_id)}
                        disabled={!editText.trim()}
                        className="save-edit-btn"
                      >
                        <Icon name="check" size={16} />
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="comment-text">
                  {comment.comment_text}
                </p>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="warning" size={20} />
                Delete Comment
              </h3>
              <button className="modal-close-btn" onClick={cancelDelete}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-form">
              <div className="delete-warning">
                <p>Are you sure you want to delete this comment?</p>
              </div>
              
              {commentToDelete && (
                <div className="comment-preview">
                  <div className="preview-author-line">
                    <Icon name="user" size={16} />
                    <span className="preview-author">
                      {commentToDelete.user.username || commentToDelete.user.display_name}
                    </span>
                  </div>
                  <div className="preview-text">
                    "{commentToDelete.comment_text.length > 100 
                      ? commentToDelete.comment_text.substring(0, 100) + '...'
                      : commentToDelete.comment_text}"
                  </div>
                </div>
              )}
              
              <div className="delete-note">
                <Icon name="info" size={16} />
                <span>This action cannot be undone.</span>
              </div>
              
              <div className="modal-actions">
                <button className="btn-cancel" onClick={cancelDelete}>
                  Cancel
                </button>
                <button 
                  className="btn-delete" 
                  onClick={confirmDeleteComment}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <div className="card-icon-spinner small"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Comment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default CommentsSection