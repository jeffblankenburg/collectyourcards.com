import { useEffect } from 'react'

const BASE_TITLE = 'Collect Your Cards'

/**
 * Custom hook to set the page title
 * Automatically appends the base site title
 *
 * @param {string} title - The page-specific title (e.g., "Dashboard", "Mike Trout")
 * @param {Array} deps - Optional dependencies array for when title should update
 */
export function usePageTitle(title, deps = []) {
  useEffect(() => {
    const fullTitle = title ? `${title} - ${BASE_TITLE}` : BASE_TITLE
    document.title = fullTitle

    // Cleanup: reset to base title when component unmounts
    return () => {
      document.title = BASE_TITLE
    }
  }, [title, ...deps])
}

export default usePageTitle
