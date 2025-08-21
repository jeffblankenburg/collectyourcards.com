import React from 'react'
import {
  // Basic icons
  Search,
  Home,
  FolderOpen,
  BarChart3,
  TrendingUp,
  User,
  HelpCircle,
  LogOut,
  Target,
  DollarSign,
  Smartphone,
  Star,
  Diamond,
  Trophy,
  Zap,
  Sparkles,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Trash2,
  // Card/Collection related
  CreditCard,
  BookOpen,
  Archive,
  FileSpreadsheet,
  Layers,
  // Team/Sports related
  Users,
  Shield,
  Flag,
  // Status/System
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Activity,
  Settings
} from 'lucide-react'

// Icon mapping for consistent usage across the app
const iconMap = {
  // App branding
  'app-logo': CreditCard,
  
  // Navigation
  'home': Home,
  'collections': FolderOpen,
  'import': FileSpreadsheet,
  'analytics': BarChart3,
  'trending': TrendingUp,
  
  // Search & Discovery
  'search': Search,
  'card': 'custom-card', // Custom card icon
  'player': User,
  'team': Shield,
  
  // User & Account
  'user': User,
  'profile': User,
  'help': HelpCircle,
  'logout': LogOut,
  'target': Target,
  'settings': Settings,
  
  // Stats & Values
  'money': DollarSign,
  'value': DollarSign,
  'stats': BarChart3,
  'chart': TrendingUp,
  
  // Actions & Features
  'mobile': Smartphone,
  'star': Star,
  'diamond': Diamond,
  'trophy': Trophy,
  'fire': Zap,
  'party': Sparkles,
  'archive': Archive,
  
  // Status & Alerts
  'success': CheckCircle,
  'error': XCircle,
  'warning': AlertTriangle,
  'info': Info,
  'activity': Activity,
  'clock': Clock,
  
  // Form & Interaction
  'eye': Eye,
  'eye-off': EyeOff,
  'delete': Trash2,
  
  // Groups & Teams
  'users': Users,
  'flag': Flag
}

// Custom card icon component - vertically-oriented rectangle with rounded corners
const SimpleCardIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 16 16" 
    className={`simple-card-icon ${className}`}
    fill="currentColor"
  >
    <rect
      x="4"
      y="1"
      width="10"
      height="14"
      rx="1.5"
      ry="1.5"
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
    />
  </svg>
)

// Custom stacked cards icon component
const StackedCardsIcon = ({ size = 16, className = '' }) => (
  <div className={`stacked-cards-icon ${className}`} style={{ width: size, height: size }}>
    <div className="card-stack">
      <div className="card-layer card-1"></div>
      <div className="card-layer card-2"></div>
      <div className="card-layer card-3"></div>
    </div>
  </div>
)

function Icon({ 
  name, 
  size = 16, 
  className = '', 
  color = 'currentColor',
  strokeWidth = 2,
  ...props 
}) {
  // Handle custom card icon
  if (name === 'card') {
    return <SimpleCardIcon size={size} className={className} />
  }
  
  // Handle custom stacked cards icon
  if (name === 'series') {
    return <StackedCardsIcon size={size} className={className} />
  }
  
  const IconComponent = iconMap[name]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in iconMap`)
    return <Search size={size} className={className} color={color} strokeWidth={strokeWidth} {...props} />
  }
  
  return (
    <IconComponent 
      size={size} 
      className={className} 
      color={color} 
      strokeWidth={strokeWidth} 
      {...props} 
    />
  )
}

export default Icon