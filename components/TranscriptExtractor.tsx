'use client'

import { useState, useEffect, useRef } from 'react'
import { extractTranscripts, getDownloadUrl, ExtractResponse, ProgressUpdate } from '@/lib/api'

export default function TranscriptExtractor() {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExtractResponse | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Timer effect
  useEffect(() => {
    if (loading && startTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          setElapsedTime(elapsed)
        }
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      if (!loading) {
        startTimeRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [loading])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playlistUrl.trim()) {
      setError('Please enter a playlist URL')
      return
    }

    setError('')
    setResults(null)
    setProgress(null)
    setLoading(true)
    setElapsedTime(0)
    startTimeRef.current = Date.now()

    try {
      const data = await extractTranscripts(playlistUrl, (progressUpdate: ProgressUpdate) => {
        setProgress(progressUpdate)
      })
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Failed to extract transcripts.')
    } finally {
      setLoading(false)
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
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
          <div className="progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="progress-label" style={{ fontSize: '1rem', fontWeight: 600 }}>
              {progress?.video_title ? (
                <span>
                  <span style={{ color: '#a78bfa' }}>▶</span> {progress.video_title}
                </span>
              ) : (
                'Processing playlist…'
              )}
            </span>
            <span style={{ 
              fontSize: '0.85rem', 
              color: '#c4b5fd', 
              fontWeight: 600,
              background: 'rgba(167, 139, 250, 0.1)',
              padding: '4px 10px',
              borderRadius: '12px'
            }}>
              ⏱️ {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="progress-track" style={{ marginBottom: 10 }}>
            <div 
              className="progress-fill" 
              style={{ 
                width: progress?.percentage ? `${Math.max(progress.percentage, 2)}%` : '2%',
                transition: 'width 0.5s ease-out'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p className="progress-status" style={{ margin: 0, fontSize: '0.9rem' }}>
                {progress?.status || 'Starting...'}
              </p>
              {progress?.current !== undefined && progress?.total !== undefined && (
                <p style={{ 
                  margin: '4px 0 0 0', 
                  fontSize: '0.85rem', 
                  color: '#a78bfa', 
                  fontWeight: 600 
                }}>
                  📊 Progress: {progress.current} of {progress.total} videos processed
                </p>
              )}
            </div>
            {progress?.percentage !== undefined && (
              <span style={{ 
                fontSize: '1.1rem', 
                color: '#a78bfa', 
                fontWeight: 700,
                minWidth: '50px',
                textAlign: 'right'
              }}>
                {progress.percentage}%
              </span>
            )}
          </div>
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
