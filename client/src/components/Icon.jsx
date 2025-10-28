import React from 'react'
import {
  // Basic icons
  Search,
  Home,
  FolderOpen,
  BarChart3,
  TrendingUp,
  User,
  UserPlus,
  UserCheck,
  HelpCircle,
  LogOut,
  LogIn,
  Target,
  DollarSign,
  Smartphone,
  Star,
  Diamond,
  Trophy,
  Zap,
  Sparkles,
  AlertTriangle,
  Triangle,
  Info,
  Eye,
  EyeOff,
  Trash2,
  Menu,
  X,
  Plus,
  PlusCircle,
  Minus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Lock,
  Check,
  ExternalLink,
  Monitor,
  // New icons for admin tables
  Heart,
  Map,
  Upload,
  Database,
  Image,
  Camera,
  Cloud,
  RefreshCw,
  ShoppingCart,
  Palette,
  Factory,
  Building,
  Link2,
  Shuffle,
  AtSign,
  Mail,
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
  Circle,
  // Status/System
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Activity,
  Settings,
  // Additional icons for player stats
  Edit,
  Hash,
  Grid3X3,
  List,
  Power,
  // Notification and social icons
  Bell,
  MessageSquare,
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  Edit3,
  Inbox,
  // Audio/moderation icons
  Mic,
  MicOff,
  // More options icons
  MoreHorizontal,
  MoreVertical,
  // Missing icons
  Download,
  Calendar,
  Crown,
  Square,
  Folder,
  Award,
  Package,
  Play,
  Code,
  Filter,
  Copy,
  GitMerge,
  Merge,
  ArrowLeftRight,
  Clipboard,
  Bookmark,
  Save
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
  'trending-up': TrendingUp,
  'layers': Layers,
  'users': Users,
  
  // Search & Discovery
  'search': Search,
  'card': 'custom-card', // Custom card icon
  'credit-card': CreditCard,
  'player': User,
  'team': Shield,
  'baseball': 'custom-baseball',
  'football': 'custom-football',
  'basketball': 'custom-basketball',
  'rc-tag': 'custom-rc-tag', // Custom RC tag for rookies
  'jersey': 'custom-jersey', // Custom jersey for relics
  'graded-slab': 'custom-graded-slab', // Custom graded slab
  
  // User & Account
  'user': User,
  'user-check': UserCheck,
  'profile': User,
  'help': HelpCircle,
  'help-circle': HelpCircle,
  'logout': LogOut,
  'power': Power,
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
  'refresh-cw': RefreshCw,
  'zap': Zap,
  'login': LogIn,
  
  // Status & Alerts
  'success': CheckCircle,
  'check-circle': CheckCircle,
  'error': XCircle,
  'x-circle': XCircle,
  'warning': AlertTriangle,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'info': Info,
  'activity': Activity,
  'loader': Activity,
  'clock': Clock,
  'circle': Circle,
  
  // Form & Interaction
  'eye': Eye,
  'eye-off': EyeOff,
  'delete': Trash2,
  'trash-2': Trash2,
  'clipboard': Clipboard,
  'bookmark': Bookmark,
  'save': Save,
  'menu': Menu,
  'close': X,
  'plus': Plus,
  'plus-circle': PlusCircle,
  'minus': Minus,
  'add': Plus,
  'user-plus': UserPlus,
  'monitor': Monitor,
  'log-in': LogIn,
  'arrow-down': ChevronDown,
  'arrow-up': ChevronUp,
  'arrow-right': ChevronRight,
  'arrow-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'lock': Lock,
  'check': Check,
  'x': X,
  'external-link': ExternalLink,
  'heart': Heart,
  'map': Map,
  'upload': Upload,
  'database': Database,
  'code': Code,
  'image': Image,
  'monitor': Monitor,
  'refresh': RefreshCw,
  'shopping': ShoppingCart,
  'color': Palette,
  'filter': Filter,
  'copy': Copy,
  'factory': Factory,
  'building': Building,
  'link': Link2,
  'shuffle': Shuffle,
  'alias': AtSign,
  'mail': Mail,
  'staging': Database, // Use same as database for staging
  'trash': Trash2,
  'git-merge': GitMerge,
  'merge': Merge,
  'combine': Merge,
  'arrow-left-right': ArrowLeftRight,

  // Groups & Teams
  'flag': Flag,
  
  // Player Stats Icons
  'edit': Edit,
  'shield': Shield,
  'hash': Hash,
  'collection': Grid3X3,
  'grid': Grid3X3,
  'list': List,
  
  // Notification and Social Icons
  'bell': Bell,
  'message-square': MessageSquare,
  'share-2': Share2,
  'twitter': Twitter,
  'facebook': Facebook,
  'linkedin': Linkedin,
  'camera': Camera,
  'cloud': Cloud,
  'edit-3': Edit3,
  'inbox': Inbox,
  
  // Audio/moderation icons
  'mic': Mic,
  'mic-off': MicOff,
  
  // More options icons
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'ellipses': MoreHorizontal,
  'download': Download,
  'calendar': Calendar,
  'crown': Crown,
  'square': Square,
  'folder': Folder,
  'award': Award,
  'package': Package,
  'play': Play
}

// Custom RC tag icon for rookies - matches the RC tags used throughout the site
const RCTagIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <rect x="2" y="6" width="20" height="12" rx="2" fill="#22c55e" stroke="#16a34a" strokeWidth="1"/>
    <text x="12" y="14" fontSize="8" textAnchor="middle" fill="white" fontWeight="bold" fontFamily="system-ui, -apple-system, sans-serif">RC</text>
  </svg>
)

// Custom shirt icon for relics - by Kim Naces from Noun Project (made bolder)
const JerseyIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="currentColor" strokeWidth="2" stroke="currentColor">
    <path d="m73.48 17.191c-4.2891-1.3711-8.7891-2.3711-13.352-2.9688l-2.1602-0.28906-0.10156 2.1797c-0.17969 3.9805-3.6406 7.1016-7.8711 7.1016-4.2305 0-7.6914-3.1211-7.8711-7.1016l-0.10156-2.1797-2.1602 0.28906c-4.5703 0.60156-9.0586 1.6016-13.352 2.9688l-0.39844 0.12891-19.703 17.352 13.379 15.672 5.3281-4.3711v39.828h49.75v-39.828l5.3281 4.3711 13.379-15.672-19.699-17.352-0.39844-0.12891zm6.2305 27.57-8.8281-7.2305v44.281l-41.762-0.003906v-44.281l-8.8281 7.2305-8.2812-9.6992 16.121-14.191c3.3398-1.0391 6.8008-1.8516 10.32-2.4102 1.25 5.0508 5.9492 8.7383 11.551 8.7383 5.6016 0 10.301-3.6992 11.551-8.7383 3.5195 0.55859 6.9883 1.3711 10.32 2.4102l16.121 14.191-8.2812 9.6992z"/>
  </svg>
)

// Custom graded slab icon - by Rizky Mardika from Noun Project (made bolder)
const GradedSlabIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="currentColor" strokeWidth="1.5" stroke="currentColor">
    <path d="m76.766 7.8359h-53.531c-1.6016 0-2.8984 1.3008-2.8984 2.8984v78.535c0 1.6016 1.3008 2.8984 2.8984 2.8984h53.531c1.6016 0 2.8984-1.3008 2.8984-2.8984v-78.535c0-1.6016-1.3008-2.8984-2.8984-2.8984zm1.8984 81.43c0 1.0469-0.85156 1.8984-1.8984 1.8984h-53.531c-1.0469 0-1.8984-0.85156-1.8984-1.8984v-78.531c0-1.0469 0.85156-1.8984 1.8984-1.8984h53.531c1.0469 0 1.8984 0.85156 1.8984 1.8984v78.535z"/>
    <path d="m68.434 32.836h-36.867c-1.6016 0-2.8984 1.3008-2.8984 2.8984v45.199c0 1.6016 1.3008 2.8984 2.8984 2.8984h36.867c1.6016 0 2.8984-1.3008 2.8984-2.8984v-45.199c0-1.6016-1.3008-2.8984-2.8984-2.8984zm1.9023 48.098c0 1.0469-0.85156 1.8984-1.8984 1.8984h-36.867c-1.0469 0-1.8984-0.85156-1.8984-1.8984v-45.199c0-1.0469 0.85156-1.8984 1.8984-1.8984h36.867c1.0469 0 1.8984 0.85156 1.8984 1.8984z"/>
    <path d="m65.066 37h-30.133c-1.1562 0-2.1016 0.94141-2.1016 2.1016v17.633c0 1.1562 0.94141 2.1016 2.1016 2.1016h30.133c1.1562 0 2.1016-0.94141 2.1016-2.1016v-17.633c0-1.1562-0.94141-2.1016-2.1016-2.1016zm1.1016 19.734c0 0.60547-0.49219 1.1016-1.1016 1.1016h-30.133c-0.60547 0-1.1016-0.49219-1.1016-1.1016v-17.633c0-0.60547 0.49219-1.1016 1.1016-1.1016h30.133c0.60547 0 1.1016 0.49219 1.1016 1.1016z"/>
    <rect x="26" y="63" width="48" height="3" fill="currentColor"/>
    <rect x="26" y="68" width="48" height="3" fill="currentColor"/>
    <rect x="26" y="73" width="48" height="3" fill="currentColor"/>
  </svg>
)

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
      x="3"
      y="0.5"
      width="11"
      height="15"
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

// Custom sports ball icons using Noun Project SVGs (see /attributions for credits)
const BaseballIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} fill="currentColor">
    <path d="M48.971,15.029a23.989,23.989,0,1,0,0,33.942A24.029,24.029,0,0,0,48.971,15.029ZM16.443,16.443A21.936,21.936,0,0,1,32,10.01a21.87,21.87,0,0,1-.5,4.7l-1.2-.247a1,1,0,0,0-.405,1.959l1.082.223A22,22,0,0,1,29.509,20.2l-.825-.448a1,1,0,0,0-.955,1.758l.777.421a21.962,21.962,0,0,1-2.245,2.92l-.588-.588a1,1,0,0,0-1.414,1.414l.588.588a21.814,21.814,0,0,1-2.92,2.245l-.421-.777a1,1,0,0,0-1.758.955l.449.826a22.1,22.1,0,0,1-3.555,1.472L16.418,29.9a1,1,0,0,0-1.959.405l.248,1.2a21.939,21.939,0,0,1-4.7.5A21.935,21.935,0,0,1,16.443,16.443ZM10.106,34a23.911,23.911,0,0,0,5-.55l.058.278a1,1,0,1,0,1.958-.4l-.077-.376a24.005,24.005,0,0,0,4.1-1.686l.268.5a1,1,0,1,0,1.758-.954l-.295-.543a24,24,0,0,0,3.381-2.588l.472.472a1,1,0,1,0,1.414-1.414l-.473-.473a23.923,23.923,0,0,0,2.59-3.379l.542.294a1,1,0,1,0,.954-1.758l-.5-.269a24.143,24.143,0,0,0,1.68-4.1l.382.078a.94.94,0,0,0,.2.021,1,1,0,0,0,.2-1.979l-.274-.057a23.916,23.916,0,0,0,.544-5A21.935,21.935,0,0,1,53.894,29.992a23.852,23.852,0,0,0-5,.545l-.056-.269a1,1,0,1,0-1.958.4l.077.378a24.07,24.07,0,0,0-4.1,1.682l-.268-.493a1,1,0,1,0-1.758.954l.294.541a23.93,23.93,0,0,0-3.379,2.591l-.473-.473a1,1,0,0,0-1.414,1.414l.473.473a23.923,23.923,0,0,0-2.59,3.379l-.542-.294a1,1,0,0,0-.954,1.758l.5.269a24.084,24.084,0,0,0-1.682,4.1l-.38-.078a1,1,0,1,0-.4,1.958l.271.057a23.918,23.918,0,0,0-.547,5A21.935,21.935,0,0,1,10.106,34ZM47.557,47.557a21.934,21.934,0,0,1-15.564,6.432,22.007,22.007,0,0,1,.5-4.7l1.2.248a1.012,1.012,0,0,0,.2.02,1,1,0,0,0,.2-1.979l-1.084-.224A22.085,22.085,0,0,1,34.49,43.8l.826.448a1,1,0,0,0,.955-1.758l-.777-.421a21.9,21.9,0,0,1,2.245-2.92l.588.588a1,1,0,0,0,1.414-1.414l-.588-.588a21.9,21.9,0,0,1,2.92-2.245l.421.777a1,1,0,0,0,1.758-.955l-.448-.825a22.036,22.036,0,0,1,3.554-1.473l.224,1.084a1,1,0,0,0,1.959-.4l-.248-1.2a21.886,21.886,0,0,1,4.7-.5A21.934,21.934,0,0,1,47.557,47.557Z"/>
  </svg>
)

const BasketballIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} fill="currentColor">
    <path d="M15.029,15.029a24,24,0,1,0,33.942,0A24.031,24.031,0,0,0,15.029,15.029ZM10.012,31.961a21.946,21.946,0,0,1,4.8-13.679c.42,5.172,1.363,10.741,4.483,16.04C14.711,36.179,10.922,32.863,10.012,31.961ZM16.669,16.24a21.844,21.844,0,0,1,11.789-5.923,14.5,14.5,0,0,0-4.191,9.373c-.06.83-.106,1.661-.151,2.484-.26,4.756-.494,8.945-3.1,11.147C17.728,27.778,17.02,21.9,16.669,16.24Zm9.444,6.043c.045-.812.09-1.632.148-2.45a12.374,12.374,0,0,1,5.767-9.821,21.927,21.927,0,0,1,14.786,5.76L24.567,38.019a27.751,27.751,0,0,1-2.456-3.012C25.561,32.283,25.843,27.211,26.113,22.283ZM24.567,40.847a29.544,29.544,0,0,0,3.4,2.757,10.122,10.122,0,0,0,1.364,10.2,21.859,21.859,0,0,1-12.143-5.58Zm5.112,3.86c5.3,3.119,10.866,4.063,16.039,4.482a21.948,21.948,0,0,1-13.679,4.8C31.134,53.072,27.824,49.282,29.679,44.707Zm-.686-2.818a27.633,27.633,0,0,1-3.012-2.456L48.228,17.186a21.924,21.924,0,0,1,5.76,14.787,12.374,12.374,0,0,1-9.82,5.766c-.819.058-1.64.1-2.453.148C36.789,38.157,31.718,38.439,28.993,41.889Zm-18.8-7.213a11.259,11.259,0,0,0,6.374,2.209,9.264,9.264,0,0,0,3.83-.849,29.524,29.524,0,0,0,2.756,3.4l-7.381,7.381A21.86,21.86,0,0,1,10.193,34.676ZM47.76,47.332c-5.661-.352-11.538-1.06-17.08-4.344,2.2-2.61,6.389-2.843,11.144-3.1.824-.045,1.656-.091,2.487-.15a14.505,14.505,0,0,0,9.372-4.192A21.857,21.857,0,0,1,47.76,47.332Z"/>
  </svg>
)

const FootballIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 100 115" className={className} fill="currentColor">
    <path d="m82.836 9.3945c-20.398-3.6641-41.305 2.8789-55.934 17.504-14.633 14.629-21.176 35.543-17.508 55.934 0.70703 3.9414 3.832 7.0664 7.7695 7.7695 3.7344 0.67188 7.4844 1 11.211 1 16.629 0 32.77-6.5547 44.723-18.508 14.629-14.629 21.176-35.539 17.508-55.934-0.70703-3.9414-3.832-7.0664-7.7695-7.7695zm-11.215 3.1641c3.4805 0 6.9883 0.30469 10.477 0.93359 2.2344 0.39844 4.0039 2.1719 4.4062 4.4062 0.71094 3.9453 0.98828 7.9141 0.89453 11.844-2.2773-3.2617-4.8633-6.3984-7.8047-9.3438-2.9453-2.9453-6.082-5.5312-9.3516-7.8086 0.45703-0.011719 0.91797-0.035156 1.3789-0.035156zm13.801 31.051c-3.1641-5.9102-7.3789-11.578-12.418-16.613-5.0391-5.0391-10.711-9.2578-16.621-12.422 2.2969-0.61328 4.6289-1.0938 6.9883-1.4258 4.7109 2.6875 9.1758 6.1055 13.277 10.203 4.0977 4.0977 7.5117 8.5586 10.195 13.262-0.33203 2.3633-0.80859 4.6992-1.4219 6.9961zm-70.844 12.781c3.1641 5.9102 7.3789 11.578 12.418 16.613 5.0391 5.0391 10.711 9.2578 16.617 12.422-2.3008 0.61328-4.6328 1.0898-6.9961 1.4219-4.707-2.6875-9.1719-6.1016-13.266-10.195-4.0977-4.0977-7.5117-8.5586-10.195-13.262 0.33203-2.3633 0.80859-4.6992 1.4219-6.9961zm3.3242 30.113c-2.2344-0.39844-4.0039-2.1719-4.4062-4.4062-0.71094-3.9453-0.98828-7.9141-0.89453-11.844 2.2773 3.2617 4.8633 6.3984 7.8047 9.3438 2.9414 2.9414 6.082 5.5273 9.3477 7.8047-3.9336 0.089844-7.8984-0.1875-11.848-0.89844zm52.25-16.352c-5.9844 5.9844-13.098 10.523-20.801 13.445-6.8906-3.0586-13.59-7.7188-19.41-13.539-5.8203-5.8203-10.48-12.516-13.539-19.406 2.9219-7.707 7.457-14.82 13.445-20.805 5.9922-5.9883 13.113-10.512 20.828-13.434 6.8828 3.0586 13.57 7.7148 19.387 13.527 5.8203 5.8203 10.48 12.516 13.539 19.406-2.9219 7.707-7.457 14.82-13.445 20.805z"/>
    <path d="m64.328 32.738-2.5078 2.5078c-0.98047-0.79688-2.0078-1.5352-3.1289-2.1445-1.0117-0.54297-2.2773-0.17187-2.8242 0.83984-0.54688 1.0117-0.17188 2.2773 0.83984 2.8242 0.75781 0.41016 1.4766 0.89844 2.1602 1.4297l-4.4141 4.4141c-0.98047-0.79688-2.0039-1.5352-3.1289-2.1406-1.0117-0.55078-2.2734-0.17188-2.8242 0.83594-0.54688 1.0117-0.17188 2.2773 0.83984 2.8242 0.75781 0.41016 1.4766 0.89844 2.1602 1.4297l-5.9453 5.9453c-0.53125-0.68359-1.0195-1.4023-1.4297-2.1602-0.54688-1.0117-1.8164-1.3867-2.8242-0.83984-1.0117 0.54688-1.3906 1.8125-0.83984 2.8242 0.60937 1.1211 1.3477 2.1484 2.1406 3.1289l-4.4141 4.4141c-0.53125-0.68359-1.0195-1.4023-1.4297-2.1602-0.54687-1.0156-1.8164-1.3867-2.8242-0.83984-1.0117 0.54688-1.3906 1.8125-0.83984 2.8242 0.60938 1.1211 1.3477 2.1484 2.1406 3.1289l-2.5078 2.5078c-0.81641 0.81641-0.81641 2.1328 0 2.9453 0.40625 0.40625 0.94141 0.60938 1.4727 0.60938 0.53516 0 1.0664-0.20312 1.4727-0.60938l2.5078-2.5078c0.97656 0.79297 1.9961 1.5273 3.1172 2.1328 0.31641 0.16797 0.65234 0.25 0.98828 0.25 0.73828 0 1.457-0.39453 1.832-1.0898 0.54687-1.0117 0.17187-2.2773-0.83984-2.8242-0.75391-0.40625-1.4648-0.89062-2.1445-1.418l4.4141-4.4141c0.97656 0.79297 1.9961 1.5234 3.1133 2.1328 0.31641 0.17188 0.65234 0.25391 0.98828 0.25391 0.73828 0 1.457-0.39453 1.832-1.0898 0.54688-1.0117 0.17188-2.2773-0.83984-2.8242-0.75391-0.41016-1.4648-0.89453-2.1484-1.4219l5.9414-5.9414c0.52734 0.67969 1.0117 1.3945 1.418 2.1445 0.37891 0.69922 1.0938 1.0898 1.832 1.0898 0.33594 0 0.67578-0.082031 0.98828-0.25 1.0117-0.54688 1.3906-1.8125 0.83984-2.8242-0.60547-1.1172-1.3398-2.1406-2.1328-3.1172l4.4141-4.4141c0.52734 0.67969 1.0117 1.3945 1.418 2.1445 0.37891 0.69922 1.0938 1.0898 1.832 1.0898 0.33594 0 0.67578-0.082031 0.98828-0.25 1.0117-0.54688 1.3906-1.8125 0.83984-2.8242-0.60547-1.1172-1.3398-2.1406-2.1328-3.1172l2.5078-2.5078c0.81641-0.81641 0.81641-2.1328 0-2.9453-0.81641-0.81641-2.1328-0.81641-2.9453 0z"/>
  </svg>
)

// Custom rainbow icon - by Viola Yorika from Noun Project
const RainbowIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="14 30 72 40" className={className} fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M50 62C47.7909 62 46 63.7909 46 66V70H38V66C38 59.3726 43.3726 54 50 54C56.6274 54 62 59.3726 62 66V70H54V66C54 63.7909 52.2091 62 50 62Z"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M50 50C41.1634 50 34 57.1634 34 66V70H26V66C26 52.7452 36.7452 42 50 42C63.2548 42 74 52.7452 74 66V70H66V66C66 57.1634 58.8366 50 50 50Z"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M50 38C34.536 38 22 50.536 22 66V70H14V66C14 46.1177 30.1177 30 50 30C69.8823 30 86 46.1177 86 66V70H78V66C78 50.536 65.464 38 50 38Z"/>
  </svg>
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
  
  // Handle custom RC tag icon
  if (name === 'rc-tag') {
    return <RCTagIcon size={size} className={className} />
  }
  
  // Handle custom jersey icon
  if (name === 'jersey') {
    return <JerseyIcon size={size} className={className} />
  }
  
  // Handle custom graded slab icon
  if (name === 'graded-slab') {
    return <GradedSlabIcon size={size} className={className} />
  }
  
  // Handle custom sports ball icons
  if (name === 'baseball') {
    return <BaseballIcon size={size} className={className} />
  }

  if (name === 'football') {
    return <FootballIcon size={size} className={className} />
  }

  if (name === 'basketball') {
    return <BasketballIcon size={size} className={className} />
  }

  // Handle custom rainbow icon
  if (name === 'rainbow') {
    return <RainbowIcon size={size} className={className} />
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