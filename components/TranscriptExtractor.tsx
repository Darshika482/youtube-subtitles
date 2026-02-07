'use client'

import { useState } from 'react'
import { extractTranscripts, getDownloadUrl, ExtractResponse } from '@/lib/api'

export default function TranscriptExtractor() {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExtractResponse | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playlistUrl.trim()) {
      setError('Please enter a playlist URL')
      return
    }

    setError('')
    setResults(null)
    setLoading(true)

    try {
      const data = await extractTranscripts(playlistUrl)
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Failed to extract transcripts.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label" htmlFor="playlistUrl">
            Playlist URL
          </label>
          <input
            type="url"
            className="input-field"
            id="playlistUrl"
            placeholder="https://www.youtube.com/playlist?list=..."
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            required
            disabled={loading}
          />
          <p className="field-hint">Paste any YouTube playlist URL (up to 50 videos)</p>
        </div>

        <button
          type="submit"
          className="btn-primary-custom"
          disabled={loading}
        >
          {loading && <span className="spinner" />}
          {loading ? 'Extracting transcripts…' : 'Extract All Transcripts → TXT'}
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="progress-container fade-in" style={{ marginTop: 20 }}>
          <div className="progress-header">
            <span className="progress-label">Processing playlist…</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '60%' }} />
          </div>
          <p className="progress-status">
            Downloading and extracting captions from each video. This may take a few minutes for large playlists.
          </p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="results-section" style={{ marginTop: 20 }}>
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card stat-purple">
              <div className="stat-value">{results.total_videos}</div>
              <div className="stat-label">Total Videos</div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-value">{results.extracted}</div>
              <div className="stat-label">Extracted</div>
            </div>
            {results.skipped > 0 && (
              <div className="stat-card stat-yellow">
                <div className="stat-value">{results.skipped}</div>
                <div className="stat-label">Skipped</div>
              </div>
            )}
          </div>

          {/* Download Button */}
          <a
            href={getDownloadUrl(results.filename || 'playlist_transcripts_clean.txt')}
            className="btn-success-custom"
            download
            style={{ marginBottom: 20 }}
          >
            📥 Download Transcript File
          </a>

          {/* Preview */}
          {results.preview && (
            <div style={{ marginTop: 20 }}>
              <div className="preview-header">
                <span className="preview-title">Preview</span>
              </div>
              <pre className="preview-box">{results.preview}</pre>
            </div>
          )}

          {/* Skipped Videos */}
          {results.skipped_videos && results.skipped_videos.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <details>
                <summary className="collapsible-header">
                  ⚠️ {results.skipped_videos.length} video(s) skipped — click to see details
                </summary>
                <ul className="skipped-list">
                  {results.skipped_videos.map((video, idx) => (
                    <li key={idx} className="skipped-item">
                      <span className="skip-icon">⚠️</span>
                      <div>
                        <div className="skip-title">{video.title}</div>
                        <div className="skip-reason">{video.reason}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert-box alert-error fade-in" style={{ marginTop: 20 }}>
          <span className="alert-icon">✕</span>
          <div className="alert-content">
            <div className="alert-title">Something went wrong</div>
            <div className="alert-text">{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}
