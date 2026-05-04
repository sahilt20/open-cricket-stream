#!/bin/sh
# docker/test-stream-source/run.sh
#
# Stand-in for the phone's Larix Broadcaster. Generates a video test pattern
# with a moving timestamp and pushes it to MediaMTX over SRT — the same path
# the phone takes in production.
#
# Use this profile to verify the streaming pipeline end-to-end without
# needing a real camera in front of you.

set -eu

TARGET_HOST="${TARGET_HOST:-mediamtx}"
TARGET_PORT="${TARGET_PORT:-8890}"
STREAM_NAME="${STREAM_NAME:-cam}"
RESOLUTION="${RESOLUTION:-1280x720}"
FPS="${FPS:-30}"

# MediaMTX has to be listening before we connect.
sleep 3

echo "[test-source] pushing testsrc → srt://${TARGET_HOST}:${TARGET_PORT}?streamid=publish:${STREAM_NAME}"

exec ffmpeg \
  -hide_banner -nostats \
  -re -f lavfi -i "testsrc2=size=${RESOLUTION}:rate=${FPS}" \
  -re -f lavfi -i "sine=frequency=440:beep_factor=4" \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -b:v 2500k -maxrate 2500k -bufsize 5000k -pix_fmt yuv420p -g 60 \
  -c:a aac -b:a 96k -ar 44100 \
  -f mpegts "srt://${TARGET_HOST}:${TARGET_PORT}?streamid=publish:${STREAM_NAME}&pkt_size=1316"
