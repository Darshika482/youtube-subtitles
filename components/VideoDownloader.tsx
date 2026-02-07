'use client'

import { useState } from 'react'
import { downloadVideo, checkVideo, getFileDownloadUrl, DownloadResponse, VideoCheckResponse } from '@/lib/api'

export default function VideoDownloader() {
  const [videoUrl, setVideoUrl] = useState('')
  const [cookieFile, setCookieFile] = useState<File | null>(null)
  const [downloadType, setDownloadType] = useState('video')
  const [quality, setQuality] = useState('best')
  const [yesPlaylist, setYesPlaylist] = useState(true)
  const [playlistStart, setPlaylistStart] = useState('')
  const [playlistEnd, setPlaylistEnd] = useState('')
  const [playlistItems, setPlaylistItems] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<VideoCheckResponse | null>(null)
  const [downloadResults, setDownloadResults] = useState<DownloadResponse | null>(null)
  const [downloadError, setDownloadError] = useState('')

  const showPlaylistOptions = videoUrl.toLowerCase().includes('playlist') || videoUrl.toLowerCase().includes('list=')

  const handleCheckVideo = async () => {
    if (!videoUrl.trim()) {
      setCheckResult({ success: false, accessible: false, error: 'Please enter a URL first' })
      return
    }
    setChecking(true)
    setCheckResult(null)
    try {
      const result = await checkVideo(videoUrl, false)
      setCheckResult(result)
    } catch (err: any) {
      setCheckResult({ success: false, accessible: false, error: err.message })
    } finally {
      setChecking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim()) {
      setDownloadError('Please enter a YouTube URL')
      return
    }

    setDownloadError('')
    setDownloadResults(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('video_url', videoUrl)
      formData.append('download_type', downloadType)
      formData.append('quality', quality)
      formData.append('yes_playlist', yesPlaylist.toString())
      if (cookieFile) formData.append('cookie_file', cookieFile)
      if (playlistStart) formData.append('playlist_start', playlistStart)
      if (playlistEnd) formData.append('playlist_end', playlistEnd)
      if (playlistItems) formData.append('playlist_items', playlistItems)

      const data = await downloadVideo(videoUrl, formData)
      setDownloadResults(data)
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed. Check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* URL Input + Check Button */}
        <div className="field-group">
          <label className="field-label" htmlFor="videoUrl">YouTube URL</label>
          <div className="input-group-custom">
            <input
              type="url"
              className="input-field"
              id="videoUrl"
              placeholder="https://www.youtube.com/watch?v=... or playlist URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              disabled={loading}
            />
            <button
              type="button"
              className="btn-outline-custom btn-check-video"
              onClick={handleCheckVideo}
              disabled={checking || loading}
            >
              {checking ? '…' : '🔍 Check'}
            </button>
          </div>
          <p className="field-hint">Single video or playlist URL</p>

          {/* Check Result */}
          {checkResult && (
            <div style={{ marginTop: 10 }}>
              {checkResult.accessible ? (
                <div className="alert-box alert-success fade-in">
                  <span className="alert-icon">✓</span>
                  <div className="alert-content">
                    <div className="alert-title">Video accessible</div>
                    <div className="alert-text">
                      {checkResult.title || 'Unknown title'}
                      {checkResult.duration ? ` · ${formatDuration(checkResult.duration)}` : ''}
                      {checkResult.formats_available ? ` · ${checkResult.formats_available} formats` : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert-box alert-warning fade-in">
                  <span className="alert-icon">⚠</span>
                  <div className="alert-content">
                    <div className="alert-title">May not be accessible</div>
                    <div className="alert-text">
                      {checkResult.error || 'Unknown error'}
                      {checkResult.hint && <><br />{checkResult.hint}</>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type + Quality */}
        <div className="row-fields">
          <div className="field-group">
            <label className="field-label" htmlFor="downloadType">Type</label>
            <select
              className="input-field"
              id="downloadType"
              value={downloadType}
              onChange={(e) => setDownloadType(e.target.value)}
              disabled={loading}
            >
              <option value="video">🎬 Video</option>
              <option value="audio">🎵 Audio Only</option>
              <option value="subtitle">📄 Subtitles Only</option>
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="quality">Quality</label>
            <select
              className="input-field"
              id="quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              disabled={loading}
            >
              <option value="best">Best Available</option>
              <option value="720p">720p (HD)</option>
              <option value="480p">480p (SD)</option>
              <option value="360p">360p</option>
              <option value="worst">Lowest</option>
            </select>
          </div>
        </div>

        {/* Cookie File */}
        <div className="field-group">
          <label className="field-label" htmlFor="cookieFile">Cookie File (optional)</label>
          <div className="file-input-wrapper">
            <input
              type="file"
              id="cookieFile"
              accept=".txt"
              onChange={(e) => setCookieFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
          </div>
          <p className="field-hint">
            Only needed for member-only or age-restricted videos.
            Upload a cookies.txt in Netscape format.
          </p>
        </div>

        {/* Playlist Options */}
        {showPlaylistOptions && (
          <div className="fade-in" style={{ marginBottom: 20 }}>
            <div className="row-fields-3">
              <div className="field-group">
                <label className="field-label" htmlFor="playlistStart">Start #</label>
                <input
                  type="number"
                  className="input-field"
                  id="playlistStart"
                  min="1"
                  placeholder="1"
                  value={playlistStart}
                  onChange={(e) => setPlaylistStart(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="playlistEnd">End #</label>
                <input
                  type="number"
                  className="input-field"
                  id="playlistEnd"
                  min="1"
                  placeholder="50"
                  value={playlistEnd}
                  onChange={(e) => setPlaylistEnd(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="playlistItems">Items</label>
                <input
                  type="text"
                  className="input-field"
                  id="playlistItems"
                  placeholder="1,3,5-10"
                  value={playlistItems}
                  onChange={(e) => setPlaylistItems(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {/* Playlist Checkbox */}
        <div className="field-group">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={yesPlaylist}
              onChange={(e) => setYesPlaylist(e.target.checked)}
              disabled={loading}
            />
            <span>Download as playlist (if URL is a playlist)</span>
          </label>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary-custom" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Downloading…' : '⬇️ Start Download'}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="progress-container fade-in" style={{ marginTop: 20 }}>
          <div className="progress-header">
            <span className="progress-label">Downloading…</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '45%' }} />
          </div>
          <p className="progress-status">
            This may take a while depending on video length and quality.
          </p>
        </div>
      )}

      {/* Results */}
      {downloadResults && downloadResults.success && (
        <div className="results-section" style={{ marginTop: 20 }}>
          <div className="alert-box alert-success">
            <span className="alert-icon">✓</span>
            <div className="alert-content">
              <div className="alert-title">Download Complete</div>
              <div className="alert-text">
                {downloadResults.message || `${downloadResults.files?.length || 0} file(s) downloaded`}
              </div>
            </div>
          </div>

          {downloadResults.files && downloadResults.files.length > 0 && (
            <div>
              {downloadResults.files.map((file, idx) => (
                <div key={idx} className="file-list-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                  <a href={getFileDownloadUrl(file.name)} className="btn-dl" download>
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {downloadError && (
        <div className="alert-box alert-error fade-in" style={{ marginTop: 20 }}>
          <span className="alert-icon">✕</span>
          <div className="alert-content">
            <div className="alert-title">Download failed</div>
            <div className="alert-text">{downloadError}</div>
          </div>
        </div>
      )}
    </div>
  )
}
