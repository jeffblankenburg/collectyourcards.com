import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import './CodeSnippet.css'

function CodeSnippet({ code, language = 'json', showLineNumbers = false }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const lines = code?.split('\n') || []

  return (
    <div className="api-docs-code-snippet">
      <div className="api-docs-code-header">
        <span className="api-docs-code-language">{language}</span>
        <button
          className="api-docs-code-copy-btn"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="api-docs-code-content">
        {showLineNumbers ? (
          <pre>
            <code>
              {lines.map((line, i) => (
                <div key={i} className="api-docs-code-line">
                  <span className="api-docs-line-number">{i + 1}</span>
                  <span className="api-docs-line-content">{line}</span>
                </div>
              ))}
            </code>
          </pre>
        ) : (
          <pre><code>{code}</code></pre>
        )}
      </div>
    </div>
  )
}

export default CodeSnippet
