# Design Standards

## Link Styling Rules

### NO BLUE LINKS EVER
- **Rule**: Never use blue (#2563eb, #3b82f6, etc.) for link colors anywhere in the application
- **Rationale**: Blue links are outdated web design and don't match our modern, sophisticated aesthetic
- **Implementation**: All links should use appropriate contextual colors:
  - On dark backgrounds: Light gray (#e2e8f0) with white hover (#ffffff)
  - On light backgrounds: Dark gray (#374151) with darker hover (#1f2937)
  - Special cases: Use theme-appropriate colors that match the context

### Link Hover Effects
- Use subtle transitions (0.3s ease) for color changes
- Consider underline effects for emphasis where appropriate
- Maintain accessibility with sufficient contrast ratios

### Examples
```css
/* ✅ GOOD - Contextual link styling */
.link-on-dark {
  color: #e2e8f0;
  text-decoration: none;
  transition: all 0.3s ease;
  border-bottom: 2px solid transparent;
}

.link-on-dark:hover {
  color: #ffffff;
  border-bottom-color: #fbbf24;
}

.link-on-light {
  color: #374151;
  text-decoration: none;
  transition: color 0.3s ease;
}

.link-on-light:hover {
  color: #1f2937;
}

/* ❌ BAD - Blue links */
.bad-link {
  color: #2563eb; /* Never use blue */
}
```

## Card Detail Page Styling

### Header Design
- Use dark gradient backgrounds (#1e293b to #475569) for premium feel
- Include subtle background patterns and effects
- Position card images on the right side of headers
- Use glassmorphism effects with backdrop filters

### Typography Hierarchy
- Main titles: Large, bold, with gradient text effects
- Secondary text: Contextual colors that complement the background
- Ensure proper contrast ratios for accessibility

### Badge Styling
- Use semi-transparent backgrounds with appropriate colors
- Implement glassmorphism with backdrop-filter: blur(10px)
- Color-coordinate badges with their actual meanings (e.g., color parallels show actual colors)

### Interactive Elements
- Smooth transitions on all hover states
- Use transform effects for button interactions
- Maintain consistent border radius (12px for modern look)

## Implementation Notes
- Always test link colors against their backgrounds for proper contrast
- Use CSS-in-JS or inline styles for dynamic color handling
- Document any exceptions to these rules with clear rationale