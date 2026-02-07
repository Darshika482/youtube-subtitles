'use client'

import { useState } from 'react'
import TranscriptExtractor from '@/components/TranscriptExtractor'
import VideoDownloader from '@/components/VideoDownloader'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'transcript' | 'downloader'>('transcript')

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="logo">YouTube Tools</div>
        <p className="tagline">Extract transcripts · Download videos</p>
      </header>

      {/* Main Card */}
      <main className="glass-card">
        <div className="card-inner">
          {/* Tab Bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
              onClick={() => setActiveTab('transcript')}
            >
              <span className="tab-icon">📝</span>
              Transcripts
            </button>
            <button
              className={`tab-btn ${activeTab === 'downloader' ? 'active' : ''}`}
              onClick={() => setActiveTab('downloader')}
            >
              <span className="tab-icon">⬇️</span>
              Downloader
            </button>
          </div>

          {/* Tab Content */}
          <div className="fade-in" key={activeTab}>
            {activeTab === 'transcript' && <TranscriptExtractor />}
            {activeTab === 'downloader' && <VideoDownloader />}
          </div>
        </div>
      </main>

      {/* Info Section */}
      <div className="info-section">
        <div className="info-title">
          <span>💡</span> How it works
        </div>
        <div className="info-grid">
          <div className="info-col">
            <h4>Transcript Extractor</h4>
            <ul>
              <li>Paste a YouTube playlist URL</li>
              <li>Extracts transcripts from up to 50 videos</li>
              <li>Cleans text to show only spoken words</li>
              <li>Download combined transcript as TXT</li>
            </ul>
          </div>
          <div className="info-col">
            <h4>Video Downloader</h4>
            <ul>
              <li>Works with single videos or playlists</li>
              <li>Choose video, audio-only, or subtitles</li>
              <li>Optional cookies for restricted content</li>
              <li>Multiple quality options available</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        Powered by yt-dlp · Built with Next.js + Flask
      </footer>
    </div>
  )
}
