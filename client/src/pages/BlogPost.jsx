import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import CommentsSection from '../components/CommentsSection'
import './BlogScoped.css'

function BlogPost() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPost()
  }, [slug])

  useEffect(() => {
    if (post) {
      document.title = `${post.title} - Feature Discussions - Collect Your Cards`
    } else {
      document.title = 'Feature Discussions - Collect Your Cards'
    }
  }, [post])

  const loadPost = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await axios.get(`/api/blog/posts/${slug}`)

      if (response.data.success) {
        setPost(response.data.post)
      }
    } catch (err) {
      console.error('Error loading blog post:', err)
      if (err.response?.status === 404) {
        setError('Blog post not found')
      } else {
        setError('Failed to load blog post')
      }
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

  if (loading) {
    return (
      <div className="blog-page">
        <div className="blog-loading">
          <div className="card-icon-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="blog-page">
        <div className="blog-error">
          <Icon name="alert-circle" size={48} />
          <h2>Post Not Found</h2>
          <p>{error || 'The post you are looking for does not exist.'}</p>
          <button onClick={() => navigate('/blog')} className="retry-button">
            <Icon name="arrow-left" size={16} />
            Back to Feature Discussions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-page">
      <div className="blog-post-container">
        {/* Back Button */}
        <button onClick={() => navigate('/blog')} className="blog-back-button">
          <Icon name="arrow-left" size={16} />
          Back to Feature Discussions
        </button>

        {/* Post Header */}
        <article className="blog-post-full">
          <div className="blog-post-header">
            <h1 className="blog-post-title-full">{post.title}</h1>
            <div className="blog-post-meta-full">
              <span className="blog-post-date">
                <Icon name="calendar" size={16} />
                {formatDate(post.date)}
              </span>
              <span className="blog-post-author">
                <Icon name="user" size={16} />
                {post.author.name}
              </span>
            </div>
            {post.categories && post.categories.length > 0 && (
              <div className="blog-post-categories-full">
                {post.categories.map((cat) => (
                  <span key={cat.id} className="blog-category-tag">
                    {cat.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Featured Image */}
          {post.featuredImage && (
            <div className="blog-post-featured-image">
              <img src={post.featuredImage} alt={post.title} />
            </div>
          )}

          {/* Post Content */}
          <div
            className="blog-post-body"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="blog-post-tags">
              <Icon name="hash" size={16} />
              {post.tags.map((tag) => (
                <span key={tag.id} className="blog-tag">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Post Footer */}
          <div className="blog-post-footer">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-post-original-link"
            >
              <Icon name="external-link" size={16} />
              View on WordPress
            </a>
          </div>
        </article>

        {/* Comments Section */}
        <CommentsSection
          itemType="blog_post"
          itemId={post.id}
          title="Discussion"
        />
      </div>
    </div>
  )
}

export default BlogPost
