import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import './BlogScoped.css'

function Blog() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    document.title = 'Feature Discussions - Collect Your Cards'
    loadCategories()
  }, [])

  useEffect(() => {
    loadPosts()
  }, [currentPage, searchQuery, selectedCategory])

  const loadCategories = async () => {
    try {
      const response = await axios.get('/api/blog/categories')
      if (response.data.success) {
        setCategories(response.data.categories.filter(cat => cat.postCount > 0))
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {
        page: currentPage,
        perPage: 10
      }

      if (searchQuery) {
        params.search = searchQuery
      }

      if (selectedCategory) {
        params.category = selectedCategory
      }

      const response = await axios.get('/api/blog/posts', { params })

      if (response.data.success) {
        setPosts(response.data.posts)
        setTotalPages(response.data.totalPages)
      }
    } catch (err) {
      console.error('Error loading blog posts:', err)
      setError('Failed to load blog posts')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const stripHtml = (html) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const handlePostClick = (slug) => {
    navigate(`/blog/${slug}`)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setCurrentPage(1) // Reset to first page on new search
  }

  const handleCategoryChange = (categorySlug) => {
    setSelectedCategory(categorySlug)
    setCurrentPage(1) // Reset to first page on filter change
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setSearchQuery('')
    setSelectedCategory('')
    setCurrentPage(1)
  }

  if (loading && posts.length === 0) {
    return (
      <div className="blog-page">
        <div className="blog-loading">
          <div className="card-icon-spinner"></div>
          <p>Loading blog posts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="blog-page">
        <div className="blog-error">
          <Icon name="alert-circle" size={48} />
          <h2>Unable to Load Blog</h2>
          <p>{error}</p>
          <button onClick={loadPosts} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-page">
      <div className="blog-container">
        {/* Header */}
        <div className="blog-header">
          <Icon name="message-square" size={32} />
          <h1>Feature Discussions</h1>
          <p className="blog-subtitle">
            Stories and insights about the features that make this site great for collectors
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="blog-filters">
          <form onSubmit={handleSearch} className="blog-search-form">
            <div className="blog-search-input-wrapper">
              <Icon name="search" size={20} />
              <input
                type="text"
                placeholder="Search blog posts..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="blog-search-input"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="blog-search-clear"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
            <button type="submit" className="blog-search-button">
              Search
            </button>
          </form>

          <div className="blog-category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="blog-category-select"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name} ({cat.postCount})
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedCategory) && (
            <button onClick={handleClearFilters} className="blog-clear-filters">
              <Icon name="x" size={16} />
              Clear Filters
            </button>
          )}
        </div>

        {/* Posts List */}
        {posts.length === 0 ? (
          <div className="blog-empty">
            <Icon name="file-text" size={48} />
            <p>
              {searchQuery || selectedCategory
                ? 'No posts found matching your filters'
                : 'No blog posts yet'}
            </p>
            {(searchQuery || selectedCategory) && (
              <button onClick={handleClearFilters} className="retry-button">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="blog-posts-list">
            {posts.map((post) => (
              <article
                key={post.id}
                className="blog-post-card"
                onClick={() => handlePostClick(post.slug)}
              >
                {post.featuredImage && (
                  <div className="blog-post-image">
                    <img src={post.featuredImage} alt={post.title} />
                  </div>
                )}
                <div className="blog-post-content">
                  <div className="blog-post-meta">
                    <span className="blog-post-date">
                      {formatDate(post.date)}
                    </span>
                    <span className="blog-post-author">
                      by {post.author.name}
                    </span>
                  </div>
                  <h2 className="blog-post-title">{post.title}</h2>
                  <div className="blog-post-excerpt">
                    {stripHtml(post.excerpt)}
                  </div>
                  {post.categories && post.categories.length > 0 && (
                    <div className="blog-post-categories">
                      {post.categories.map((cat) => (
                        <span key={cat.id} className="blog-category-tag">
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="blog-post-read-more">
                    Read more <Icon name="arrow-right" size={16} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="blog-pagination">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="blog-pagination-button"
            >
              <Icon name="chevron-left" size={16} />
              Previous
            </button>
            <span className="blog-pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="blog-pagination-button"
            >
              Next
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Blog
