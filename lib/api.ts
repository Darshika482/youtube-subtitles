// For local dev: call Flask directly on port 5000 (CORS is enabled in Flask)
// For production: set NEXT_PUBLIC_API_BASE_URL to your deployed Flask backend URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export interface ExtractResponse {
  success: boolean;
  total_videos: number;
  extracted: number;
  skipped: number;
  preview: string;
  filename: string;
  skipped_videos?: Array<{ title: string; reason: string }>;
  error?: string;
}

export interface DownloadResponse {
  success: boolean;
  message: string;
  files?: Array<{ name: string; size: number; path: string }>;
  strategy_used?: string;
  method?: string;
  output?: string;
  warnings?: string;
  error?: string;
  hints?: string[];
  available_browsers?: string[];
}

export interface VideoCheckResponse {
  success: boolean;
  accessible: boolean;
  title?: string;
  duration?: number;
  is_live?: boolean;
  availability?: string;
  formats_available?: number;
  error?: string;
  hint?: string;
}

// Safe JSON parser that handles non-JSON server errors
async function safeJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      response.status === 502 || response.status === 504
        ? 'Backend server is restarting. Please wait a moment and try again.'
        : `Server error (${response.status}): ${text.slice(0, 150)}`
    );
  }
}

export interface ProgressUpdate {
  type: 'progress' | 'status' | 'complete' | 'error';
  current?: number;
  total?: number;
  percentage?: number;
  status?: string;
  video_title?: string;
  message?: string;
  success?: boolean;
  extracted?: number;
  skipped?: number;
  preview?: string;
  filename?: string;
  skipped_videos?: Array<{ title: string; reason: string }>;
  error?: string;
}

export async function extractTranscripts(
  playlistUrl: string,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<ExtractResponse> {
  // If onProgress callback provided, use SSE for real-time updates
  if (onProgress) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Use POST with SSE streaming
      fetch(`${API_BASE}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playlist_url: playlistUrl,
          use_sse: true,
          job_id: jobId
        }),
      }).then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            reject(new Error(data.error || 'Failed to start extraction'));
          });
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          reject(new Error('Stream not available'));
          return;
        }

        let buffer = '';

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  try {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr) {
                      const data = JSON.parse(jsonStr);
                      onProgress(data);

                      if (data.type === 'complete') {
                        reader.cancel();
                        resolve({
                          success: data.success || false,
                          total_videos: data.total_videos || 0,
                          extracted: data.extracted || 0,
                          skipped: data.skipped || 0,
                          preview: data.preview || '',
                          filename: data.filename || 'playlist_transcripts_clean.txt',
                          skipped_videos: data.skipped_videos || []
                        });
                        return;
                      } else if (data.type === 'error') {
                        reader.cancel();
                        reject(new Error(data.message || data.error || 'Extraction failed'));
                        return;
                      }
                    }
                  } catch (e) {
                    // Skip invalid JSON lines
                    console.warn('Failed to parse SSE data:', line);
                  }
                }
              }
            }
            // Stream ended without completion
            reject(new Error('Stream ended unexpectedly'));
          } catch (error: any) {
            reject(error);
          }
        };

        processStream();
      }).catch(error => {
        reject(error);
      });
    });
  }

  // Fallback to regular request if no progress callback
  const response = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlist_url: playlistUrl }),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data.error || 'Failed to extract transcripts');
  }
  return data;
}

export async function downloadVideo(
  videoUrl: string,
  formData: FormData
): Promise<DownloadResponse> {
  const response = await fetch(`${API_BASE}/download-video`, {
    method: 'POST',
    body: formData,
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data.error || 'Download failed');
  }
  return data;
}

export async function checkVideo(videoUrl: string, useCookies = false): Promise<VideoCheckResponse> {
  const response = await fetch(`${API_BASE}/check-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, use_cookies: useCookies }),
  });

  return await safeJson(response);
}

export function getDownloadUrl(filename: string): string {
  return `${API_BASE}/download/${filename}`;
}

export function getFileDownloadUrl(filename: string): string {
  return `${API_BASE}/download-file/${encodeURIComponent(filename)}`;
}
