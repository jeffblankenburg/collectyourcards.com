const express = require('express')
const router = express.Router()
const axios = require('axios')

const WORDPRESS_SITE = 'jeffblankenburg04.wordpress.com'
const WORDPRESS_API_BASE = `https://public-api.wordpress.com/rest/v1.1/sites/${WORDPRESS_SITE}`

// GET /api/blog/posts - Fetch all blog posts from WordPress
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, perPage = 10, search = '', category = '' } = req.query

    const params = {
      number: perPage,
      page: page,
      order_by: 'date',
      order: 'DESC'
    }

    // Add search parameter if provided
    if (search) {
      params.search = search
    }

    // Add category parameter if provided
    if (category) {
      params.category = category
    }

    const response = await axios.get(`${WORDPRESS_API_BASE}/posts/`, {
      params
    })

    // Transform WordPress data to simpler format
    const posts = response.data.posts.map(post => ({
      id: post.ID,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      date: post.date,
      modified: post.modified,
      author: {
        name: post.author.name,
        firstName: post.author.first_name,
        lastName: post.author.last_name
      },
      url: post.URL,
      slug: post.slug,
      featuredImage: post.featured_image,
      categories: Object.values(post.categories || {}).map(cat => ({
        id: cat.ID,
        name: cat.name,
        slug: cat.slug
      })),
      tags: Object.values(post.tags || {}).map(tag => ({
        id: tag.ID,
        name: tag.name,
        slug: tag.slug
      }))
    }))

    res.json({
      success: true,
      posts,
      found: response.data.found,
      page: parseInt(page),
      perPage: parseInt(perPage),
      totalPages: Math.ceil(response.data.found / perPage)
    })
  } catch (error) {
    console.error('Error fetching WordPress posts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog posts',
      message: error.message
    })
  }
})

// GET /api/blog/categories - Fetch all categories from WordPress
router.get('/categories', async (req, res) => {
  try {
    const response = await axios.get(`${WORDPRESS_API_BASE}/categories/`, {
      params: {
        number: 100 // Get up to 100 categories
      }
    })

    const categories = Object.values(response.data.categories || {}).map(cat => ({
      id: cat.ID,
      name: cat.name,
      slug: cat.slug,
      postCount: cat.post_count
    }))

    res.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Error fetching WordPress categories:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    })
  }
})

// GET /api/blog/posts/:slug - Fetch single blog post by slug
router.get('/posts/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const response = await axios.get(`${WORDPRESS_API_BASE}/posts/slug:${slug}`)

    const post = {
      id: response.data.ID,
      title: response.data.title,
      excerpt: response.data.excerpt,
      content: response.data.content,
      date: response.data.date,
      modified: response.data.modified,
      author: {
        name: response.data.author.name,
        firstName: response.data.author.first_name,
        lastName: response.data.author.last_name
      },
      url: response.data.URL,
      slug: response.data.slug,
      featuredImage: response.data.featured_image,
      categories: Object.values(response.data.categories || {}).map(cat => ({
        id: cat.ID,
        name: cat.name,
        slug: cat.slug
      })),
      tags: Object.values(response.data.tags || {}).map(tag => ({
        id: tag.ID,
        name: tag.name,
        slug: tag.slug
      }))
    }

    res.json({
      success: true,
      post
    })
  } catch (error) {
    console.error('Error fetching WordPress post:', error)

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        message: `No post found with slug: ${req.params.slug}`
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog post',
      message: error.message
    })
  }
})

module.exports = router
