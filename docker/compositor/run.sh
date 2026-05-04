#!/bin/sh
# docker/compositor/run.sh
#
# FFmpeg compositor entrypoint for the local docker-compose stack.
#
# Pulls the camera feed from MediaMTX, composites the overlay PNG produced by
# the score-engine, and writes the result to either:
#   - a local MP4 file (default for local dev), or
#   - an RTMPS endpoint such as YouTube Live (set OUTPUT_URL=rtmps://...).
#
# Same role as pi/configs/ffmpeg-stream.sh but parameterised for the container.
# When deploying to the Pi we'll switch VIDEO_CODEC to h264_v4l2m2m to use the
# hardware encoder; locally we default to libx264.

set -eu

INPUT_URL="${INPUT_URL:-rtmp://mediamtx:1935/cam}"
OUTPUT_URL="${OUTPUT_URL:-file:///out/local.mp4}"
OVERLAY_PNG="${OVERLAY_PNG:-/overlay/overlay-out/overlay.png}"
VIDEO_CODEC="${VIDEO_CODEC:-libx264}"

mkdir -p "$(dirname "${OVERLAY_PNG}")"
mkdir -p /out

# Drop a 1×1 transparent PNG so FFmpeg's overlay filter has a valid frame
# to start with. We always overwrite (a) so corrupted files from previous runs
# don't break the pipeline, and (b) so the file modification time updates and
# downstream watchers can detect a "fresh" overlay even when state hasn't
# changed. Phase 2's Puppeteer renderer replaces this with the real overlay
# every time the score changes.
cp -f /placeholder.png "${OVERLAY_PNG}"

OUTPUT_FORMAT=flv
OUTPUT_TARGET="${OUTPUT_URL}"
case "${OUTPUT_URL}" in
  file://*)
    OUTPUT_FORMAT=mp4
    OUTPUT_TARGET="${OUTPUT_URL#file://}"
    ;;
  rtmps://*|rtmp://*)
    OUTPUT_FORMAT=flv
    ;;
  *)
    echo "[compositor] unsupported OUTPUT_URL scheme: ${OUTPUT_URL}" >&2
    exit 1
    ;;
esac

echo "[compositor] input=${INPUT_URL} output=${OUTPUT_URL} codec=${VIDEO_CODEC} overlay=${OVERLAY_PNG}"

# Wait for MediaMTX to start receiving the publisher before we attach.
# Without this the compositor exits immediately on a fresh stack.
sleep 2

exec ffmpeg -y \
  -hide_banner -nostats \
  -fflags +genpts \
  -i "${INPUT_URL}" \
  -loop 1 -framerate 1 -i "${OVERLAY_PNG}" \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto[v]" \
  -map "[v]" -map "0:a?" \
  -c:v "${VIDEO_CODEC}" -preset veryfast -tune zerolatency \
  -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -c:a aac -b:a 128k -ar 44100 \
  -f "${OUTPUT_FORMAT}" "${OUTPUT_TARGET}"
