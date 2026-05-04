#!/usr/bin/env bash
# /usr/local/bin/ocs-ffmpeg-stream
#
# Pulls the phone's SRT stream from MediaMTX, composites the overlay PNG, and
# pushes RTMPS to YouTube while also writing a local MP4 fallback.
#
# Sourced from /etc/ocs/score-engine.env via the systemd unit:
#   YOUTUBE_RTMPS_URL    e.g. rtmps://a.rtmp.youtube.com/live2
#   YOUTUBE_STREAM_KEY   the stream key from the YouTube live event
#   OVERLAY_OUT_DIR      e.g. /var/ocs/overlay-out

set -euo pipefail

: "${YOUTUBE_RTMPS_URL:?YOUTUBE_RTMPS_URL not set}"
: "${YOUTUBE_STREAM_KEY:?YOUTUBE_STREAM_KEY not set}"
OVERLAY_OUT_DIR="${OVERLAY_OUT_DIR:-/var/ocs/overlay-out}"
RECORDINGS_DIR="/var/ocs/recordings"
mkdir -p "${RECORDINGS_DIR}"

OVERLAY_PNG="${OVERLAY_OUT_DIR}/overlay.png"

# If the overlay PNG hasn't been generated yet (Phase 2 work), use a 1x1
# transparent placeholder so FFmpeg has *something* to composite.
if [[ ! -f "${OVERLAY_PNG}" ]]; then
  printf '\x89PNG\r\n\x1a\n' > "${OVERLAY_PNG}"
  python3 - <<'PY' "${OVERLAY_PNG}"
import sys, struct, zlib
path = sys.argv[1]
data = (
    b'\x89PNG\r\n\x1a\n'
    + struct.pack('>I', 13) + b'IHDR'
    + struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)
)
ihdr_crc = zlib.crc32(data[12:12+4+13])
data += struct.pack('>I', ihdr_crc)
raw = b'\x00\x00\x00\x00\x00'
comp = zlib.compress(raw)
data += struct.pack('>I', len(comp)) + b'IDAT' + comp
data += struct.pack('>I', zlib.crc32(b'IDAT' + comp))
data += struct.pack('>I', 0) + b'IEND'
data += struct.pack('>I', zlib.crc32(b'IEND'))
open(path, 'wb').write(data)
PY
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOCAL_MP4="${RECORDINGS_DIR}/match-${TIMESTAMP}.mp4"

# Run FFmpeg until the YouTube push fails or we're killed.
# - Input 0: SRT pull from MediaMTX
# - Input 1: overlay PNG (re-read continuously so changes appear)
# - Output 0: local MP4 fallback (always, even if YouTube fails)
# - Output 1: RTMPS push to YouTube
exec ffmpeg \
  -hide_banner -nostats \
  -i "rtmp://localhost:1935/cam" \
  -loop 1 -framerate 1 -i "${OVERLAY_PNG}" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto[v]" \
  -map "[v]" -map 0:a? \
  -c:v h264_v4l2m2m -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -c:a aac -b:a 128k -ar 44100 \
  -f tee \
  "[f=mp4]${LOCAL_MP4}|[f=flv]${YOUTUBE_RTMPS_URL}/${YOUTUBE_STREAM_KEY}"
