import os
import re
import json
import time
import shutil
import sys
import traceback
import threading
from flask import Flask, render_template, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
import subprocess

app = Flask(__name__)
# Enable CORS so a separate frontend (e.g. Vercel) can call this API.
# In production you can restrict origins via the CORS_ORIGINS env var.
CORS(app, resources={r"/*": {"origins": os.environ.get("CORS_ORIGINS", "*")}})
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size (for cookie files)
app.config['UPLOAD_FOLDER'] = 'temp'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['DOWNLOADS_FOLDER'] = 'downloads'
app.config['COOKIES_FOLDER'] = 'cookies'

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(app.config['DOWNLOADS_FOLDER'], exist_ok=True)
os.makedirs(app.config['COOKIES_FOLDER'], exist_ok=True)

# Progress tracking for SSE
progress_store = {}
progress_lock = threading.Lock()


def extract_spoken_words_only(vtt_file):
    """Extract and clean spoken words from VTT subtitle file."""
    try:
        with open(vtt_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f"[Error reading file: {str(e)}]"
    
    # Remove <c> tags (coloring/styling tags)
    text = re.sub(r'<c[^>]*>|</c>', '', content)
    
    # Remove WEBVTT header, cue numbers, and timestamps
    text = re.sub(r'WEBVTT\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
    # Remove timestamps (handles both comma and dot formats)
    text = re.sub(r'\d{1,2}:\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[\.,]\d{3}.*?\n', '', text, flags=re.MULTILINE)
    # Also handle shorter timestamp format (MM:SS)
    text = re.sub(r'\d{1,2}:\d{2}[\.,]\d{3}\s*-->\s*\d{1,2}:\d{2}[\.,]\d{3}.*?\n', '', text, flags=re.MULTILINE)
    
    # Remove audio cues like [Music], [Applause], [Silence], [Sound]
    text = re.sub(r'\[(?:Music|Applause|Silence|Sound|Laughter|Crowd).*?\]', '', text, flags=re.IGNORECASE)
    
    # Remove speaker labels (e.g., "Speaker 1:", ">>")
    text = re.sub(r'^[A-Z][a-z]+(?:\s+\d+)?:\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^>>\s*', '', text, flags=re.MULTILINE)
    
    # Remove HTML entities and tags
    text = re.sub(r'&[a-z]+;', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean up whitespace
    text = re.sub(r'^\s+|\s+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    
    # Join lines into natural flow
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    text = ' '.join(lines)
    
    # Final cleanup
    text = text.strip()
    
    return text if len(text) > 50 else "[No clear speech detected]"


def get_playlist_videos(playlist_url):
    """Get list of video IDs and titles from playlist using yt-dlp."""
    try:
        cmd = [
            'yt-dlp',
            '--flat-playlist',
            '--dump-json',
            '--playlist-end', '50',  # Limit to 50 videos
            playlist_url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            return None, f"Error fetching playlist: {result.stderr}"
        
        videos = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    videos.append({
                        'id': data.get('id', ''),
                        'title': data.get('title', 'Unknown Title'),
                        'url': f"https://www.youtube.com/watch?v={data.get('id', '')}"
                    })
                except json.JSONDecodeError:
                    continue
        
        return videos, None
    except subprocess.TimeoutExpired:
        return None, "Request timed out"
    except Exception as e:
        return None, f"Error: {str(e)}"


def download_subtitle(video_id, video_url):
    """Download subtitle for a single video using multiple strategies."""
    temp_dir = app.config['UPLOAD_FOLDER']
    # Ensure temp directory exists
    os.makedirs(temp_dir, exist_ok=True)
    output_template = os.path.join(temp_dir, f'{video_id}.%(ext)s')
    
    # Get JavaScript runtime if available
    js_runtime = get_js_runtime()
    js_runtime_args = []
    if js_runtime:
        js_runtime_args = ['--js-runtimes', js_runtime]
        print(f"  Using JavaScript runtime: {js_runtime}", file=sys.stderr)
    else:
        print(f"  WARNING: No JavaScript runtime found. Trying without JS runtime...", file=sys.stderr)
        # Try to use yt-dlp without JS runtime - it may still work for some videos
        # Add --no-check-certificate and other flags that might help
        pass
    
    # Base command options
    base_opts = [
        'yt-dlp',
        '--skip-download',
        '--write-sub',
        '--write-auto-sub',
        '--sub-lang', 'en',
        '--convert-subs', 'vtt',
        '--ignore-errors',  # Continue even if one video fails
    ]
    base_opts.extend(js_runtime_args)
    
    # If no JS runtime, try to use older extraction methods that don't require JS
    if not js_runtime:
        # These options might help when JS runtime is not available
        # Use m3u8 format which doesn't require JS, and try to get subtitles directly
        base_opts.extend([
            '--extractor-args', 'youtube:skip=dash',  # Skip DASH which requires JS
            '--no-check-certificate',  # Sometimes helps with connection issues
        ])
    
    # Multiple strategies to try
    # If no JS runtime, prioritize Android/iOS clients which may work better without JS
    if not js_runtime:
        # Android and iOS clients often work better without JS runtime
        strategies = [
            {
                'name': 'android_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=android',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'ios_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=ios',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'web_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=web',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'default',
                'cmd': base_opts + [
                    '-o', output_template,
                    video_url,
                ]
            }
        ]
    else:
        # With JS runtime, web client is usually best
        strategies = [
            {
                'name': 'web_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=web',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'android_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=android',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'ios_client',
                'cmd': base_opts + [
                    '--extractor-args', 'youtube:player_client=ios',
                    '-o', output_template,
                    video_url,
                ]
            },
            {
                'name': 'default',
                'cmd': base_opts + [
                    '-o', output_template,
                    video_url,
                ]
            }
        ]
    
    # Try browser cookies if available
    try:
        available_browsers = get_browser_cookies()
        for browser in available_browsers[:2]:  # Limit to 2 browsers
            browser_cmd = base_opts + [
                '--cookies-from-browser', browser,
                '--extractor-args', 'youtube:player_client=web',
                '-o', output_template,
                video_url,
            ]
            strategies.insert(0, {
                'name': f'browser_{browser}',
                'cmd': browser_cmd
            })
    except:
        pass  # Continue without browser cookies
    
    last_error = None
    
    for idx, strategy in enumerate(strategies):
        # Small delay between strategies to avoid rate limiting (except first one)
        if idx > 0:
            time.sleep(0.5)
        
        try:
            print(f"  Trying {strategy['name']} for {video_id}...", file=sys.stderr)
            result = subprocess.run(
                strategy['cmd'],
                capture_output=True,
                text=True,
                timeout=45,
                shell=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            )

            # Check for VTT file with multiple patterns
            # Wait a tiny bit for file system to sync
            time.sleep(0.1)
            
            if os.path.exists(temp_dir):
                # Pattern 1: video_id.vtt
                # Pattern 2: video_id.en.vtt  
                # Pattern 3: Any file starting with video_id and ending with .vtt
                # Pattern 4: Files with video_id in the name (yt-dlp sometimes adds extra chars)
                vtt_files = []
                for file in os.listdir(temp_dir):
                    if file.endswith('.vtt'):
                        # Check if video_id is in the filename (before the .vtt extension)
                        file_base = file[:-4]  # Remove .vtt
                        if video_id in file_base or file.startswith(video_id):
                            vtt_file = os.path.join(temp_dir, file)
                            if os.path.exists(vtt_file):
                                file_size = os.path.getsize(vtt_file)
                                if file_size > 50:  # At least 50 bytes
                                    vtt_files.append((vtt_file, file_size, file))
                
                if vtt_files:
                    # Use the largest file (most complete)
                    vtt_files.sort(key=lambda x: x[1], reverse=True)
                    best_file, file_size, file_name = vtt_files[0]
                    print(f"  ✓ Found subtitle: {file_name} ({file_size} bytes)", file=sys.stderr)
                    return best_file, None

            # Get full error output for debugging
            error_output = (result.stderr or '') + (result.stdout or '')
            
            # Log full error for debugging (show more details)
            if error_output:
                # Show first 800 chars to see full error messages
                error_preview = error_output[:800].replace('\n', ' | ')
                print(f"  Full output: {error_preview}", file=sys.stderr)
            
            # If command failed, log error
            if result.returncode != 0:
                error_lower = error_output.lower()
                
                # Check for specific error types - look for full error messages
                if 'no subtitles' in error_lower or 'subtitles are not available' in error_lower or 'has no subtitles' in error_lower or 'no subtitles available' in error_lower:
                    # Extract the actual error message
                    error_lines = error_output.split('\n')
                    subtitle_error = next((line for line in error_lines if 'subtitle' in line.lower() or 'caption' in line.lower()), None)
                    if subtitle_error:
                        last_error = subtitle_error.strip()[:200]
                    else:
                        last_error = "No subtitles available for this video"
                    print(f"  ✗ {strategy['name']}: {last_error}", file=sys.stderr)
                    break  # No point trying other strategies
                elif 'private' in error_lower or 'unavailable' in error_lower or 'video unavailable' in error_lower or 'unavailable' in error_lower:
                    last_error = "Video is private or unavailable"
                    print(f"  ✗ {strategy['name']}: Video unavailable", file=sys.stderr)
                    break  # No point trying other strategies
                elif 'sign in' in error_lower or 'members only' in error_lower or 'member-only' in error_lower:
                    last_error = "Video requires sign-in or membership"
                    print(f"  ✗ {strategy['name']}: Requires authentication", file=sys.stderr)
                    continue  # Try browser cookies if available
                elif 'rate limit' in error_lower or '429' in error_output or 'too many requests' in error_lower:
                    last_error = "Rate limited by YouTube, please wait"
                    print(f"  ✗ {strategy['name']}: Rate limited", file=sys.stderr)
                    time.sleep(2)  # Wait a bit before next strategy
                    continue
                else:
                    # Try next strategy - extract meaningful error
                    error_lines = error_output.split('\n')
                    # Look for ERROR or WARNING lines
                    error_line = next((line for line in error_lines if 'ERROR' in line or 'error' in line.lower()), None)
                    if error_line:
                        error_msg = error_line.strip()[:200]
                    else:
                        error_msg = error_output[:200] if error_output else "Unknown error"
                    print(f"  ✗ {strategy['name']} failed: {error_msg}", file=sys.stderr)
                    if not last_error or ('no subtitles' not in last_error.lower() and 'unavailable' not in last_error.lower()):
                        last_error = error_msg
                    continue
            else:
                # Command succeeded but no file found - might be rate limited or truly no subtitles
                if 'no subtitles' in error_output.lower() or 'subtitles are not available' in error_output.lower() or 'has no subtitles' in error_output.lower():
                    last_error = "No subtitles available for this video"
                    print(f"  ✗ {strategy['name']}: No subtitles available", file=sys.stderr)
                    break  # No point trying other strategies
                else:
                    # Command succeeded but no file - might be a timing issue, try next strategy
                    print(f"  ⚠ {strategy['name']} succeeded but no VTT file found", file=sys.stderr)
                    if not last_error:
                        last_error = "Command succeeded but no subtitle file created"
                    continue
                    
        except subprocess.TimeoutExpired:
            print(f"  ✗ {strategy['name']} timed out", file=sys.stderr)
            if not last_error:
                last_error = f"{strategy['name']}: Timeout"
            continue
        except Exception as e:
            print(f"  ✗ {strategy['name']} exception: {str(e)}", file=sys.stderr)
            if not last_error:
                last_error = f"{strategy['name']}: {str(e)}"
            continue
    
    # All strategies failed
    return None, last_error or "All subtitle download strategies failed. Video may not have subtitles available."


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'message': 'Server is running'})


def update_progress(job_id, current, total, status, video_title=None):
    """Update progress for a job."""
    with progress_lock:
        progress_store[job_id] = {
            'current': current,
            'total': total,
            'percentage': int((current / total * 100)) if total > 0 else 0,
            'status': status,
            'video_title': video_title or '',
            'timestamp': time.time()
        }

@app.route('/extract', methods=['POST'])
def extract_transcripts():
    """Extract transcripts from YouTube playlist."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid request data'}), 400
            
        playlist_url = data.get('playlist_url', '').strip()
        use_sse = data.get('use_sse', False)
        job_id = data.get('job_id')
        
        if not playlist_url:
            return jsonify({'error': 'Please provide a playlist URL'}), 400
        
        # Validate YouTube URL
        if 'youtube.com' not in playlist_url and 'youtu.be' not in playlist_url:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
    except Exception as e:
        return jsonify({'error': f'Error parsing request: {str(e)}'}), 400
    
    # If SSE requested, return streaming response
    if use_sse and job_id:
        return Response(stream_with_context(extract_transcripts_stream(playlist_url, job_id)),
                       mimetype='text/event-stream',
                       headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
    
    try:
        # Get playlist videos
        videos, error = get_playlist_videos(playlist_url)
        if error:
            return jsonify({'error': error}), 400
        
        if not videos:
            return jsonify({'error': 'No videos found in playlist'}), 400
        
        total_videos = len(videos)
        transcripts = []
        skipped = []
        
        # Process each video
        for idx, video in enumerate(videos, 1):
            video_id = video['id']
            video_title = video['title']
            video_url = video['url']
            
            # Download subtitle
            vtt_file, error = download_subtitle(video_id, video_url)
            
            if error or not vtt_file:
                # Log the error for debugging
                print(f"Video {idx}/{total_videos}: {video_title} - {error}", file=sys.stderr)
                skipped.append({
                    'title': video_title,
                    'reason': error or 'No captions available'
                })
                time.sleep(1)  # Rate limiting
                continue
            
            # Extract and clean transcript
            transcript_text = extract_spoken_words_only(vtt_file)
            
            if transcript_text and transcript_text != "[No clear speech detected]":
                transcripts.append({
                    'title': video_title,
                    'text': transcript_text
                })
            
            # Clean up temp file
            try:
                if os.path.exists(vtt_file):
                    os.remove(vtt_file)
            except:
                pass
            
            # Rate limiting
            time.sleep(1)
        
        # Combine all transcripts
        combined_text = ""
        for transcript in transcripts:
            combined_text += f"=== {transcript['title']} ===\n\n{transcript['text']}\n\n\n"
        
        # Save to file
        output_filename = 'playlist_transcripts_clean.txt'
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(combined_text)
        
        # Get preview (first 500 chars)
        preview = combined_text[:500] + "..." if len(combined_text) > 500 else combined_text
        
        return jsonify({
            'success': True,
            'total_videos': total_videos,
            'extracted': len(transcripts),
            'skipped': len(skipped),
            'preview': preview,
            'filename': output_filename,
            'skipped_videos': skipped
        })
    
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in extract_transcripts: {error_trace}", file=sys.stderr)
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

def extract_transcripts_stream(playlist_url, job_id):
    """Stream progress updates for transcript extraction."""
    try:
        # Get playlist videos
        yield f"data: {json.dumps({'type': 'status', 'message': 'Fetching playlist information...', 'percentage': 5})}\n\n"
        
        videos, error = get_playlist_videos(playlist_url)
        if error:
            yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"
            return
        
        if not videos:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No videos found in playlist'})}\n\n"
            return
        
        total_videos = len(videos)
        transcripts = []
        skipped = []
        
        update_progress(job_id, 0, total_videos, 'Processing videos', '')
        yield f"data: {json.dumps({'type': 'progress', 'current': 0, 'total': total_videos, 'percentage': 0, 'status': 'Starting...', 'video_title': ''})}\n\n"
        
        # Process each video
        for idx, video in enumerate(videos, 1):
            video_id = video['id']
            video_title = video['title']
            video_url = video['url']
            
            percentage = int((idx / total_videos) * 90)  # Reserve 10% for final processing
            update_progress(job_id, idx, total_videos, 'Downloading subtitle', video_title)
            yield f"data: {json.dumps({'type': 'progress', 'current': idx, 'total': total_videos, 'percentage': percentage, 'status': 'Downloading subtitle', 'video_title': video_title})}\n\n"
            
            # Download subtitle
            vtt_file, error = download_subtitle(video_id, video_url)
            
            if error or not vtt_file:
                skipped.append({
                    'title': video_title,
                    'reason': error or 'No captions available'
                })
                update_progress(job_id, idx, total_videos, f'Skipped: {error[:50]}', video_title)
                skip_reason = error[:50] if error else "No captions"
                yield f"data: {json.dumps({'type': 'progress', 'current': idx, 'total': total_videos, 'percentage': percentage, 'status': f'Skipped: {skip_reason}', 'video_title': video_title})}\n\n"
                time.sleep(1)
                continue
            
            # Extract and clean transcript
            transcript_text = extract_spoken_words_only(vtt_file)
            
            if transcript_text and transcript_text != "[No clear speech detected]":
                transcripts.append({
                    'title': video_title,
                    'text': transcript_text
                })
                update_progress(job_id, idx, total_videos, 'Extracted transcript', video_title)
                yield f"data: {json.dumps({'type': 'progress', 'current': idx, 'total': total_videos, 'percentage': percentage, 'status': 'Extracted transcript', 'video_title': video_title})}\n\n"
            
            # Clean up temp file
            try:
                if os.path.exists(vtt_file):
                    os.remove(vtt_file)
            except:
                pass
            
            time.sleep(1)
        
        # Combine all transcripts
        yield f"data: {json.dumps({'type': 'status', 'message': 'Combining transcripts...', 'percentage': 95})}\n\n"
        combined_text = ""
        for transcript in transcripts:
            combined_text += f"=== {transcript['title']} ===\n\n{transcript['text']}\n\n\n"
        
        # Save to file
        output_filename = 'playlist_transcripts_clean.txt'
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(combined_text)
        
        # Get preview (first 500 chars)
        preview = combined_text[:500] + "..." if len(combined_text) > 500 else combined_text
        
        # Final result
        result = {
            'type': 'complete',
            'success': True,
            'total_videos': total_videos,
            'extracted': len(transcripts),
            'skipped': len(skipped),
            'preview': preview,
            'filename': output_filename,
            'skipped_videos': skipped
        }
        update_progress(job_id, total_videos, total_videos, 'Complete', '')
        yield f"data: {json.dumps(result)}\n\n"
        
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in extract_transcripts_stream: {error_trace}", file=sys.stderr)
        yield f"data: {json.dumps({'type': 'error', 'message': f'Unexpected error: {str(e)}'})}\n\n"


@app.route('/download/<filename>')
def download_file(filename):
    """Download the generated transcript file."""
    try:
        file_path = os.path.join(app.config['OUTPUT_FOLDER'], secure_filename(filename))
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/cleanup', methods=['POST'])
def cleanup():
    """Clean up temporary files."""
    try:
        # Clean temp folder
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
            except:
                pass
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def validate_cookie_file(cookie_path):
    """Validate cookie file format."""
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Check if it's Netscape format (should have # Netscape HTTP Cookie File header)
            if '# Netscape HTTP Cookie File' in content or '# HTTP Cookie File' in content:
                # Check if it has YouTube cookies
                if 'youtube.com' in content.lower() or '.youtube.com' in content.lower():
                    return True, "Valid cookie file with YouTube cookies"
                else:
                    return False, "Cookie file doesn't contain YouTube cookies"
            # Also accept if it has cookie-like structure
            elif '\t' in content and 'youtube' in content.lower():
                return True, "Cookie file appears valid"
            else:
                return False, "Invalid cookie file format (should be Netscape format)"
    except Exception as e:
        return False, f"Error reading cookie file: {str(e)}"


def get_js_runtime():
    """Detect available JavaScript runtime for yt-dlp."""
    # Check common Node.js locations (for Render deployments)
    node_paths = [
        'node',  # System PATH
        '/tmp/node-v20.11.0-linux-x64/bin/node',  # Render build location
        '/usr/local/bin/node',
        '/usr/bin/node',
        os.path.join(os.environ.get('HOME', ''), '.local/bin/node'),
    ]
    
    # Try Node.js first (most common)
    for node_cmd in node_paths:
        try:
            result = subprocess.run(
                [node_cmd, '--version'],
                capture_output=True,
                text=True,
                timeout=2,
                shell=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            if result.returncode == 0:
                node_version = result.stdout.strip()
                print(f"  Detected Node.js: {node_version} at {node_cmd}", file=sys.stderr)
                return 'node'
        except Exception as e:
            continue
    
    # Try Deno
    try:
        result = subprocess.run(
            ['deno', '--version'],
            capture_output=True,
            text=True,
            timeout=2,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        if result.returncode == 0:
            return 'deno'
    except:
        pass
    
    return None

def get_browser_cookies():
    """Try to find browser cookies automatically."""
    browsers = ['chrome', 'firefox', 'edge', 'opera', 'brave']
    available = []
    for browser in browsers:
        try:
            # Test if browser cookies are accessible
            test_cmd = ['yt-dlp', '--cookies-from-browser', browser, '--list-formats', '--no-warnings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']
            result = subprocess.run(
                test_cmd,
                capture_output=True,
                text=True,
                timeout=5,
                shell=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            if result.returncode == 0 or 'format' in result.stdout.lower():
                available.append(browser)
        except:
            pass
    return available


@app.route('/download-video', methods=['POST'])
def download_video():
    """Download YouTube video(s) using yt-dlp - legitimate method."""
    try:
        # Get form data
        video_url = request.form.get('video_url', '').strip()
        cookie_file = request.files.get('cookie_file')
        download_type = request.form.get('download_type', 'video')
        quality = request.form.get('quality', 'best')
        yes_playlist = request.form.get('yes_playlist', 'false') == 'true'
        playlist_start = request.form.get('playlist_start', '').strip()
        playlist_end = request.form.get('playlist_end', '').strip()
        playlist_items = request.form.get('playlist_items', '').strip()
        
        if not video_url:
            return jsonify({'error': 'Please provide a YouTube URL'}), 400
        
        # Validate YouTube URL
        if 'youtube.com' not in video_url and 'youtu.be' not in video_url:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
        
        # Handle cookie file upload with validation
        cookie_path = None
        cookie_valid = False
        cookie_message = ""
        if cookie_file and cookie_file.filename:
            cookie_filename = secure_filename(cookie_file.filename)
            cookie_path = os.path.join(app.config['COOKIES_FOLDER'], cookie_filename)
            cookie_file.save(cookie_path)
            cookie_valid, cookie_message = validate_cookie_file(cookie_path)
            if not cookie_valid:
                return jsonify({
                    'error': f'Invalid cookie file: {cookie_message}',
                    'hint': 'Please export cookies in Netscape format while logged into YouTube'
                }), 400
        
        # Build download strategies - legitimate methods only
        # Strategy: Try without cookies first (for public videos), then with cookies if needed
        strategies = []
        
        # Get available browser cookies automatically
        available_browsers = get_browser_cookies()
        
        # Strategy 1: Try without cookies (for public videos) - most common case
        # Use web client first (most reliable for public videos)
        player_clients = ['web', 'android', 'ios']
        
        for client in player_clients:
            cmd = ['yt-dlp', '--no-warnings']
            cmd.extend(['--extractor-args', f'youtube:player_client={client}'])
            strategies.append({
                'name': f'Public video ({client} client)',
                'cmd': cmd,
                'use_cookies': False,
                'priority': 1 if client == 'web' else 2
            })
        
        # Strategy 2: If cookies provided, try with file cookies
        if cookie_path and os.path.exists(cookie_path) and cookie_valid:
            for client in ['web', 'android']:
                cmd = ['yt-dlp', '--no-warnings']
                cmd.extend(['--extractor-args', f'youtube:player_client={client}'])
                cmd.extend(['--cookies', cookie_path])
                strategies.append({
                    'name': f'File cookies ({client} client)',
                    'cmd': cmd,
                    'use_cookies': True,
                    'priority': 3
                })
        
        # Strategy 3: Try browser cookies automatically (if available)
        for browser in available_browsers:
            cmd = ['yt-dlp', '--no-warnings']
            cmd.extend(['--extractor-args', 'youtube:player_client=web'])
            cmd.extend(['--cookies-from-browser', browser])
            strategies.append({
                'name': f'Auto {browser.capitalize()} cookies',
                'cmd': cmd,
                'use_cookies': True,
                'priority': 4
            })
        
        # Sort strategies by priority (public videos first, then cookies)
        strategies.sort(key=lambda x: x.get('priority', 99))
        
        # Add common options to all strategies
        for strategy in strategies:
            strategy_cmd = strategy['cmd']
            
            # Playlist options
            if yes_playlist:
                strategy_cmd.append('--yes-playlist')
            
            if playlist_start:
                strategy_cmd.extend(['--playlist-start', playlist_start])
            
            if playlist_end:
                strategy_cmd.extend(['--playlist-end', playlist_end])
            
            if playlist_items:
                strategy_cmd.extend(['--playlist-items', playlist_items])
            
            # Download type options
            if download_type == 'audio':
                strategy_cmd.extend(['-x', '--audio-format', 'mp3'])
            elif download_type == 'subtitle':
                strategy_cmd.extend(['--write-auto-sub', '--sub-format', 'srt', '--sub-lang', 'en', '--skip-download'])
            else:
                # Video download
                if quality == 'best':
                    strategy_cmd.extend(['-f', 'bestvideo+bestaudio/best'])
                elif quality == '720p':
                    strategy_cmd.extend(['-f', '22'])
                elif quality == '480p':
                    strategy_cmd.extend(['-f', '18'])
                elif quality == '360p':
                    strategy_cmd.extend(['-f', '18'])
                elif quality == 'worst':
                    strategy_cmd.extend(['-f', 'worst'])
            
            # Output template
            output_template = os.path.join(app.config['DOWNLOADS_FOLDER'], '%(title)s.%(ext)s')
            strategy_cmd.extend(['-o', output_template])
            
            # Add URL
            strategy_cmd.append(video_url)
        
        # Try each strategy
        last_error = None
        downloaded_files = []
        result = None
        
        for strategy in strategies:
            try:
                print(f"Trying strategy: {strategy['name']}", file=sys.stderr)
                result = subprocess.run(
                    strategy['cmd'],
                    capture_output=True,
                    text=True,
                    timeout=600,  # 10 minute timeout
                    shell=False,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
                
                # Check if files were downloaded
                if os.path.exists(app.config['DOWNLOADS_FOLDER']):
                    current_time = time.time()
                    for file in os.listdir(app.config['DOWNLOADS_FOLDER']):
                        file_path = os.path.join(app.config['DOWNLOADS_FOLDER'], file)
                        if os.path.isfile(file_path):
                            file_mtime = os.path.getmtime(file_path)
                            # Check if file was modified in the last 2 minutes
                            if current_time - file_mtime < 120:
                                downloaded_files.append({
                                    'name': file,
                                    'size': os.path.getsize(file_path),
                                    'path': file_path
                                })
                
                # If files were downloaded, success!
                if downloaded_files:
                    break
                
                # If no files but no error, continue to next strategy
                if result.returncode == 0:
                    continue
                
                # Store error for reporting
                error_msg = result.stderr or result.stdout or 'Unknown error'
                if 'member' in error_msg.lower() or 'private' in error_msg.lower() or 'unavailable' in error_msg.lower():
                    last_error = f"{strategy['name']}: {error_msg[:300]}"
                elif 'ERROR' in error_msg.upper():
                    last_error = f"{strategy['name']}: {error_msg[:300]}"
                    
            except subprocess.TimeoutExpired:
                last_error = f"{strategy['name']}: Download timed out"
                continue
            except Exception as e:
                last_error = f"{strategy['name']}: {str(e)}"
                continue
        
        # If no files downloaded after all strategies, return error with helpful hints
        if len(downloaded_files) == 0:
            error_msg = last_error or 'Download failed - no files were downloaded'
            
            # Provide specific hints based on error
            hints = []
            if result:
                error_output = (result.stderr or result.stdout or '').lower()
                if 'member' in error_output or 'private' in error_output:
                    hints.append("This appears to be a member-only or private video")
                    hints.append("You need to provide valid cookies from a browser where you're logged in as a member")
                    if available_browsers:
                        hints.append(f"Auto-detected browsers: {', '.join(available_browsers)} - trying these automatically")
                elif 'unavailable' in error_output or 'not available' in error_output:
                    hints.append("Video may be unavailable in your region or removed")
                    hints.append("Try using cookies from a browser where you can view the video")
                elif 'age' in error_output or 'restricted' in error_output:
                    hints.append("Age-restricted content requires cookies")
                    hints.append("Export cookies while logged into YouTube")
                else:
                    hints.append("Try downloading without cookies first (for public videos)")
                    if cookie_path:
                        hints.append("If cookies were provided, make sure they're valid and fresh")
                    if available_browsers:
                        hints.append(f"Auto-detected browsers: {', '.join(available_browsers)}")
            
            return jsonify({
                'error': error_msg,
                'hints': hints,
                'strategies_tried': len(strategies),
                'available_browsers': available_browsers,
                'stderr': result.stderr[:1000] if result and result.stderr else '',
                'stdout': result.stdout[:1000] if result and result.stdout else ''
            }), 400
        
        # Return success with downloaded files (already collected above)
        strategy_used = None
        for s in strategies:
            if downloaded_files:
                strategy_used = s['name']
                break
        
        return jsonify({
            'success': True,
            'message': f'Successfully downloaded {len(downloaded_files)} file(s)',
            'files': downloaded_files,
            'strategy_used': strategy_used,
            'method': 'No cookies' if not strategy_used or 'cookie' not in strategy_used.lower() else 'With cookies',
            'output': result.stdout[:2000] if result and result.stdout else '',
            'warnings': result.stderr[:500] if result and result.stderr and 'WARNING' in result.stderr else ''
        })
    
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Download timed out (10 minutes)'}), 408
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in download_video: {error_trace}", file=sys.stderr)
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@app.route('/check-video', methods=['POST'])
def check_video():
    """Check if video is accessible and get info."""
    try:
        data = request.get_json()
        video_url = data.get('video_url', '').strip()
        use_cookies = data.get('use_cookies', False)
        
        if not video_url:
            return jsonify({'error': 'Please provide a YouTube URL'}), 400
        
        # Try to get video info
        cmd = ['yt-dlp', '--dump-json', '--no-warnings']
        
        # Try with cookies if requested
        if use_cookies:
            available_browsers = get_browser_cookies()
            if available_browsers:
                cmd.extend(['--cookies-from-browser', available_browsers[0]])
        
        cmd.append(video_url)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode == 0:
            try:
                video_info = json.loads(result.stdout)
                return jsonify({
                    'success': True,
                    'accessible': True,
                    'title': video_info.get('title', 'Unknown'),
                    'duration': video_info.get('duration', 0),
                    'is_live': video_info.get('is_live', False),
                    'availability': video_info.get('availability', 'public'),
                    'formats_available': len(video_info.get('formats', []))
                })
            except json.JSONDecodeError:
                return jsonify({
                    'success': True,
                    'accessible': True,
                    'info': 'Video accessible but info parsing failed'
                })
        else:
            error_msg = result.stderr or result.stdout or 'Unknown error'
            return jsonify({
                'success': False,
                'accessible': False,
                'error': error_msg[:500],
                'hint': 'Video may be private, member-only, or unavailable. Try with cookies if you have access.'
            }), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/list-formats', methods=['POST'])
def list_formats():
    """List available formats for a YouTube video."""
    try:
        data = request.get_json()
        video_url = data.get('video_url', '').strip()
        use_cookies = data.get('use_cookies', False)
        
        if not video_url:
            return jsonify({'error': 'Please provide a YouTube URL'}), 400
        
        cmd = ['yt-dlp', '-F', '--no-warnings']
        
        # Try with cookies if requested
        if use_cookies:
            available_browsers = get_browser_cookies()
            if available_browsers:
                cmd.extend(['--cookies-from-browser', available_browsers[0]])
        
        cmd.append(video_url)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            return jsonify({'error': result.stderr[:500]}), 400
        
        return jsonify({
            'success': True,
            'formats': result.stdout
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download-file/<path:filename>')
def download_downloaded_file(filename):
    """Download a file from the downloads folder."""
    try:
        file_path = os.path.join(app.config['DOWNLOADS_FOLDER'], secure_filename(filename))
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # use_reloader=False prevents Flask from restarting when yt-dlp
    # modifies files in site-packages, which kills in-flight requests.
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
