document.addEventListener('DOMContentLoaded', function() {
    // Base URL for API requests.
    // - When frontend and backend are on the same origin, leave as ''.
    // - For Vercel (static frontend) calling a remote backend, set
    //   window.APP_CONFIG.API_BASE_URL in index.html to your backend URL.
    const API_BASE =
        (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ||
        '';
    const form = document.getElementById('extractForm');
    const extractBtn = document.getElementById('extractBtn');
    const btnText = document.getElementById('btnText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    const previewText = document.getElementById('previewText');
    const transcriptDownloadBtn = document.getElementById('transcriptDownloadBtn');
    const downloadFilename = document.getElementById('downloadFilename');
    const resultsSummary = document.getElementById('resultsSummary');
    const skippedSection = document.getElementById('skippedSection');
    const skippedList = document.getElementById('skippedList');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const playlistUrl = document.getElementById('playlistUrl').value.trim();
        
        if (!playlistUrl) {
            showError('Please enter a playlist URL');
            return;
        }

        // Reset UI
        hideAllSections();
        extractBtn.disabled = true;
        loadingSpinner.classList.remove('d-none');
        btnText.textContent = 'Processing...';
        progressSection.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressText.textContent = 'Fetching playlist information...';

        try {
            const response = await fetch(API_BASE + '/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ playlist_url: playlistUrl })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }

            // Show results
            showResults(data);

        } catch (error) {
            showError(error.message || 'Failed to extract transcripts. Please check the playlist URL and try again.');
        } finally {
            extractBtn.disabled = false;
            loadingSpinner.classList.add('d-none');
            btnText.textContent = 'Extract All Transcripts → TXT';
        }
    });

    function showResults(data) {
        // Update progress to 100%
        progressBar.style.width = '100%';
        progressBar.classList.remove('progress-bar-animated');
        progressText.textContent = `Complete! Extracted ${data.extracted} out of ${data.total_videos} videos`;

        // Show results section
        resultsSection.classList.remove('d-none');
        
        // Update summary
        resultsSummary.textContent = 
            `Successfully extracted ${data.extracted} transcript(s) from ${data.total_videos} video(s). ` +
            (data.skipped > 0 ? `${data.skipped} video(s) were skipped (no captions available).` : '');

        // Show preview
        previewText.textContent = data.preview || 'No preview available';

        // Set download link
        downloadFilename.textContent = data.filename || 'playlist_transcripts_clean.txt';
        transcriptDownloadBtn.href = `${API_BASE}/download/${data.filename || 'playlist_transcripts_clean.txt'}`;

        // Show skipped videos if any
        if (data.skipped_videos && data.skipped_videos.length > 0) {
            skippedSection.classList.remove('d-none');
            skippedList.innerHTML = '';
            data.skipped_videos.forEach(video => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `<strong>${escapeHtml(video.title)}</strong><br><small class="text-muted">${escapeHtml(video.reason)}</small>`;
                skippedList.appendChild(li);
            });
        } else {
            skippedSection.classList.add('d-none');
        }
    }

    function showError(message) {
        errorSection.classList.remove('d-none');
        errorMessage.textContent = message;
        progressSection.classList.add('d-none');
    }

    function hideAllSections() {
        resultsSection.classList.add('d-none');
        errorSection.classList.add('d-none');
        skippedSection.classList.add('d-none');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Simulate progress updates (since backend doesn't stream progress)
    // In a real implementation, you'd use Server-Sent Events or WebSockets
    function simulateProgress(total) {
        let current = 0;
        const interval = setInterval(() => {
            current += 1;
            const percent = Math.min((current / total) * 100, 95);
            progressBar.style.width = percent + '%';
            progressText.textContent = `Video ${current}/${total} (${Math.round(percent)}%) - Processing...`;
            
            if (current >= total) {
                clearInterval(interval);
            }
        }, 500);
    }

    // Video Downloader functionality
    const downloadForm = document.getElementById('downloadForm');
    const videoUrlInput = document.getElementById('videoUrl');
    const checkVideoBtn = document.getElementById('checkVideoBtn');
    const videoCheckResult = document.getElementById('videoCheckResult');
    const videoDownloadBtn = document.getElementById('downloadBtn');
    const downloadBtnText = document.getElementById('downloadBtnText');
    const downloadSpinner = document.getElementById('downloadSpinner');
    const downloadProgressSection = document.getElementById('downloadProgressSection');
    const downloadProgressBar = document.getElementById('downloadProgressBar');
    const downloadProgressText = document.getElementById('downloadProgressText');
    const downloadLog = document.getElementById('downloadLog');
    const downloadResultsSection = document.getElementById('downloadResultsSection');
    const downloadResultsSummary = document.getElementById('downloadResultsSummary');
    const downloadErrorSection = document.getElementById('downloadErrorSection');
    const downloadErrorMessage = document.getElementById('downloadErrorMessage');
    const playlistOptions = document.getElementById('playlistOptions');
    const yesPlaylistCheckbox = document.getElementById('yesPlaylist');

    // Check video accessibility
    if (checkVideoBtn) {
        checkVideoBtn.addEventListener('click', async function() {
            const videoUrl = videoUrlInput.value.trim();
            if (!videoUrl) {
                videoCheckResult.innerHTML = '<div class="alert alert-warning">Please enter a URL first</div>';
                return;
            }

            checkVideoBtn.disabled = true;
            checkVideoBtn.textContent = 'Checking...';
            videoCheckResult.innerHTML = '<div class="alert alert-info">Checking video accessibility...</div>';

            try {
                const response = await fetch(API_BASE + '/check-video', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ video_url: videoUrl, use_cookies: false })
                });

                const data = await response.json();

                if (data.accessible) {
                    videoCheckResult.innerHTML = `
                        <div class="alert alert-success">
                            <strong>✅ Video is accessible!</strong><br>
                            Title: ${escapeHtml(data.title || 'Unknown')}<br>
                            Duration: ${data.duration ? Math.floor(data.duration / 60) + ':' + (data.duration % 60).toString().padStart(2, '0') : 'N/A'}<br>
                            Formats available: ${data.formats_available || 'Unknown'}
                        </div>
                    `;
                } else {
                    videoCheckResult.innerHTML = `
                        <div class="alert alert-warning">
                            <strong>⚠️ Video may not be accessible</strong><br>
                            ${escapeHtml(data.error || 'Unknown error')}<br>
                            <small>${escapeHtml(data.hint || '')}</small>
                        </div>
                    `;
                }
            } catch (error) {
                videoCheckResult.innerHTML = `<div class="alert alert-danger">Error checking video: ${escapeHtml(error.message)}</div>`;
            } finally {
                checkVideoBtn.disabled = false;
                checkVideoBtn.textContent = '🔍 Check';
            }
        });
    }

    // Show/hide playlist options based on URL
    videoUrlInput.addEventListener('input', function() {
        const url = this.value.toLowerCase();
        if (url.includes('playlist') || url.includes('list=')) {
            playlistOptions.style.display = 'block';
            yesPlaylistCheckbox.checked = true;
        } else {
            playlistOptions.style.display = 'none';
            yesPlaylistCheckbox.checked = false;
        }
    });

    if (downloadForm) {
        downloadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const videoUrl = videoUrlInput.value.trim();
            const cookieFile = document.getElementById('cookieFile').files[0];
            const downloadType = document.getElementById('downloadType').value;
            const quality = document.getElementById('quality').value;
            const yesPlaylist = yesPlaylistCheckbox.checked;
            const playlistStart = document.getElementById('playlistStart').value;
            const playlistEnd = document.getElementById('playlistEnd').value;
            const playlistItems = document.getElementById('playlistItems').value;
            
            if (!videoUrl) {
                showDownloadError('Please enter a YouTube URL');
                return;
            }

            // Reset UI
            hideDownloadSections();
            videoDownloadBtn.disabled = true;
            downloadSpinner.classList.remove('d-none');
            downloadBtnText.textContent = 'Downloading...';
            downloadProgressSection.classList.remove('d-none');
            downloadProgressBar.style.width = '10%';
            downloadProgressText.textContent = 'Starting download...';
            downloadLog.textContent = '';

            // Create FormData
            const formData = new FormData();
            formData.append('video_url', videoUrl);
            formData.append('download_type', downloadType);
            formData.append('quality', quality);
            formData.append('yes_playlist', yesPlaylist);
            if (cookieFile) {
                formData.append('cookie_file', cookieFile);
            }
            if (playlistStart) {
                formData.append('playlist_start', playlistStart);
            }
            if (playlistEnd) {
                formData.append('playlist_end', playlistEnd);
            }
            if (playlistItems) {
                formData.append('playlist_items', playlistItems);
            }

            try {
                // Simulate progress
                let progress = 10;
                const progressInterval = setInterval(() => {
                    progress = Math.min(progress + 2, 90);
                    downloadProgressBar.style.width = progress + '%';
                    downloadProgressText.textContent = `Downloading... ${progress}%`;
                }, 1000);

                const response = await fetch(API_BASE + '/download-video', {
                    method: 'POST',
                    body: formData
                });

                clearInterval(progressInterval);
                downloadProgressBar.style.width = '100%';

                const data = await response.json();

                if (!response.ok) {
                    showDownloadError(data.error || 'Download failed', data);
                    return;
                }

                // Show results
                showDownloadResults(data);

            } catch (error) {
                showDownloadError(error.message || 'Failed to download video. Please check the URL and try again.', {});
            } finally {
                videoDownloadBtn.disabled = false;
                downloadSpinner.classList.add('d-none');
                downloadBtnText.textContent = '⬇️ Start Download';
            }
        });
    }

    function showDownloadError(message, data) {
        downloadErrorSection.classList.remove('d-none');
        
        let errorHtml = `<strong>${escapeHtml(message)}</strong>`;
        
        if (data && data.hints && Array.isArray(data.hints)) {
            errorHtml += '<ul class="mt-2 mb-0">';
            data.hints.forEach(hint => {
                errorHtml += `<li>${escapeHtml(hint)}</li>`;
            });
            errorHtml += '</ul>';
        }
        
        if (data && data.available_browsers && data.available_browsers.length > 0) {
            errorHtml += `<p class="mt-2 mb-0"><small>Auto-detected browsers: ${data.available_browsers.join(', ')}</small></p>`;
        }
        
        downloadErrorMessage.innerHTML = errorHtml;
        downloadProgressSection.classList.add('d-none');
    }

    function showDownloadResults(data) {
        downloadProgressBar.classList.remove('progress-bar-animated');
        downloadProgressText.textContent = 'Download complete!';
        
        if (data.output) {
            downloadLog.textContent = data.output;
        }

        downloadResultsSection.classList.remove('d-none');
        downloadResultsSummary.textContent = data.message || `Successfully downloaded ${data.files?.length || 0} file(s)`;

        // List downloaded files
        if (data.files && data.files.length > 0) {
            const filesList = document.createElement('div');
            filesList.className = 'mt-3';
            filesList.innerHTML = '<h6>Downloaded Files:</h6><ul class="list-group">';
            
            data.files.forEach(file => {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>${escapeHtml(file.name)}</span>
                    <div>
                        <span class="badge bg-secondary me-2">${sizeMB} MB</span>
                        <a href="${API_BASE}/download-file/${encodeURIComponent(file.name)}" class="btn btn-sm btn-primary">Download</a>
                    </div>
                `;
                filesList.querySelector('ul').appendChild(li);
            });
            
            filesList.innerHTML += '</ul>';
            downloadResultsSection.appendChild(filesList);
        }
    }

    function showDownloadError(message) {
        downloadErrorSection.classList.remove('d-none');
        downloadErrorMessage.textContent = message;
        downloadProgressSection.classList.add('d-none');
    }

    function hideDownloadSections() {
        downloadResultsSection.classList.add('d-none');
        downloadErrorSection.classList.add('d-none');
        // Clear previous file lists
        const fileLists = downloadResultsSection.querySelectorAll('div.mt-3');
        fileLists.forEach(el => el.remove());
    }
});
