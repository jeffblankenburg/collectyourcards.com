import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

// Custom hook for optimized admin sets data loading
// This replaces multiple API calls with single optimized calls + caching
export const useOptimizedAdminSets = () => {
  // State for all the data types
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Static data (cached for 5 minutes)
  const [organizations, setOrganizations] = useState([])
  const [manufacturers, setManufacturers] = useState([])
  const [colors, setColors] = useState([])
  const [staticDataLoaded, setStaticDataLoaded] = useState(false)
  
  // Page data (cached for 1 minute)
  const [years, setYears] = useState([])
  const [sets, setSets] = useState([])
  const [series, setSeries] = useState([])
  const [currentSet, setCurrentSet] = useState(null)
  
  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState({
    totalApiCalls: 0,
    totalQueryTime: 0,
    cacheHits: 0,
    dbQueriesExecuted: 0
  })
  
  // Load static data once (organizations, manufacturers, colors)
  const loadStaticData = useCallback(async () => {
    if (staticDataLoaded) return // Already loaded
    
    try {
      console.log('🔄 Loading static data (organizations, manufacturers, colors)...')
      const startTime = performance.now()
      
      const response = await axios.get('/api/admin/sets-optimized/static-data')
      const endTime = performance.now()
      
      setOrganizations(response.data.organizations || [])
      setManufacturers(response.data.manufacturers || [])  
      setColors(response.data.colors || [])
      setStaticDataLoaded(true)
      
      // Update performance stats
      setPerformanceStats(prev => ({
        ...prev,
        totalApiCalls: prev.totalApiCalls + 1,
        totalQueryTime: prev.totalQueryTime + (endTime - startTime),
        cacheHits: prev.cacheHits + (response.data.performance.cacheHit ? 1 : 0),
        dbQueriesExecuted: prev.dbQueriesExecuted + response.data.performance.queriesExecuted
      }))
      
      console.log(`✅ Static data loaded in ${Math.round(endTime - startTime)}ms (${response.data.performance.queriesExecuted} queries, cache: ${response.data.performance.cacheHit})`)
      
    } catch (err) {
      console.error('Error loading static data:', err)
      setError('Failed to load dropdown data')
    }
  }, [staticDataLoaded])
  
  // Load years with counts
  const loadYears = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔄 Loading years...')
      const startTime = performance.now()
      
      const response = await axios.get('/api/admin/sets-optimized/years')
      const endTime = performance.now()
      
      setYears(response.data.years || [])
      
      // Update performance stats
      setPerformanceStats(prev => ({
        ...prev,
        totalApiCalls: prev.totalApiCalls + 1,
        totalQueryTime: prev.totalQueryTime + (endTime - startTime),
        cacheHits: prev.cacheHits + (response.data.performance.cacheHit ? 1 : 0),
        dbQueriesExecuted: prev.dbQueriesExecuted + response.data.performance.queriesExecuted
      }))
      
      console.log(`✅ Years loaded in ${Math.round(endTime - startTime)}ms (${response.data.performance.queriesExecuted} queries, cache: ${response.data.performance.cacheHit})`)
      
    } catch (err) {
      console.error('Error loading years:', err)
      setError('Failed to load years')
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Load sets for a specific year
  const loadSetsForYear = useCallback(async (year) => {
    try {
      setLoading(true)
      setError(null)
      console.log(`🔄 Loading sets for year ${year}...`)
      const startTime = performance.now()
      
      const response = await axios.get(`/api/admin/sets-optimized/by-year/${year}`)
      const endTime = performance.now()
      
      setSets(response.data.sets || [])
      
      // Update performance stats
      setPerformanceStats(prev => ({
        ...prev,
        totalApiCalls: prev.totalApiCalls + 1,
        totalQueryTime: prev.totalQueryTime + (endTime - startTime),
        cacheHits: prev.cacheHits + (response.data.performance.cacheHit ? 1 : 0),
        dbQueriesExecuted: prev.dbQueriesExecuted + response.data.performance.queriesExecuted
      }))
      
      console.log(`✅ Sets for ${year} loaded in ${Math.round(endTime - startTime)}ms (${response.data.performance.queriesExecuted} queries, cache: ${response.data.performance.cacheHit})`)
      
    } catch (err) {
      console.error('Error loading sets:', err)
      setError(`Failed to load sets for year ${year}`)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Load series for a specific set
  const loadSeriesForSet = useCallback(async (year, setSlug) => {
    try {
      setLoading(true)
      setError(null)
      console.log(`🔄 Loading series for ${year}/${setSlug}...`)
      const startTime = performance.now()
      
      const response = await axios.get(`/api/admin/sets-optimized/series/${year}/${setSlug}`)
      const endTime = performance.now()
      
      setSeries(response.data.series || [])
      setCurrentSet(response.data.set || null)
      
      // Update performance stats  
      setPerformanceStats(prev => ({
        ...prev,
        totalApiCalls: prev.totalApiCalls + 1,
        totalQueryTime: prev.totalQueryTime + (endTime - startTime),
        cacheHits: prev.cacheHits + (response.data.performance.cacheHit ? 1 : 0),
        dbQueriesExecuted: prev.dbQueriesExecuted + response.data.performance.queriesExecuted
      }))
      
      console.log(`✅ Series for ${year}/${setSlug} loaded in ${Math.round(endTime - startTime)}ms (${response.data.performance.queriesExecuted} queries, cache: ${response.data.performance.cacheHit})`)
      
    } catch (err) {
      console.error('Error loading series:', err)
      setError(`Failed to load series for set ${setSlug}`)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Reset performance stats
  const resetPerformanceStats = useCallback(() => {
    setPerformanceStats({
      totalApiCalls: 0,
      totalQueryTime: 0,
      cacheHits: 0,
      dbQueriesExecuted: 0
    })
  }, [])
  
  // Load static data on mount
  useEffect(() => {
    loadStaticData()
  }, [loadStaticData])
  
  return {
    // State
    loading,
    error,
    
    // Static data
    organizations,
    manufacturers,
    colors,
    staticDataLoaded,
    
    // Page data
    years,
    sets,
    series,
    currentSet,
    
    // Actions
    loadYears,
    loadSetsForYear,
    loadSeriesForSet,
    loadStaticData,
    
    // Performance tracking
    performanceStats,
    resetPerformanceStats
  }
}