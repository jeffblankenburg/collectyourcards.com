import React from 'react'
import { Lock, Unlock, Shield } from 'lucide-react'
import './AuthBadge.css'

function AuthBadge({ auth }) {
  if (!auth?.required) {
    return (
      <span className="api-docs-auth-badge api-docs-auth-public">
        <Unlock size={12} />
        Public
      </span>
    )
  }

  const roles = auth.roles || []
  const isAdmin = roles.includes('admin') || roles.includes('superadmin')

  if (isAdmin) {
    return (
      <span className="api-docs-auth-badge api-docs-auth-admin">
        <Shield size={12} />
        Admin
      </span>
    )
  }

  return (
    <span className="api-docs-auth-badge api-docs-auth-required">
      <Lock size={12} />
      Auth Required
    </span>
  )
}

export default AuthBadge
