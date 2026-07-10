package com.lingring.app;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;

import org.webrtc.audio.JavaAudioDeviceModule;

import java.io.File;
import java.nio.ByteBuffer;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

// #193 Phase 3: 마이크 PCM(JavaAudioDeviceModule.setSamplesReadyCallback)을
// MediaCodec(AAC-LC) 으로 인코딩해 MediaMuxer 로 .m4a 파일에 쓴다.
// iOS AudioRecordingADM 의 파일 write 경로에 대응. 통화 중 강제 종료 시 moov atom 미기록으로
// 파일이 깨질 수 있음 — iOS(AVAssetWriter)와 동일한 알려진 한계로, recovery 업로드 시
// BE 분석이 실패할 수 있다 (v1 패리티).
final class RecordingWriter {
    private static final String TAG = "RecordingWriter";
    private static final int BIT_RATE = 48_000;
    private static final long CODEC_TIMEOUT_US = 10_000;
    private static final int STOP_TIMEOUT_SEC = 3;

    private final File file;
    private final HandlerThread thread;
    private final Handler handler;

    private MediaCodec codec;
    private MediaMuxer muxer;
    private int trackIndex = -1;
    private boolean muxerStarted;
    private long totalPcmFrames;
    private int sampleRate;
    private int channels;
    private volatile boolean closed;

    RecordingWriter(final File file) {
        this.file = file;
        this.thread = new HandlerThread("lingring.recording.writer");
        this.thread.start();
        this.handler = new Handler(thread.getLooper());
    }

    File file() {
        return file;
    }

    // WebRtcAudioRecord 스레드에서 호출 — 데이터를 복사해 워커 스레드로 넘긴다 (캡처 스레드 무블로킹).
    void write(final JavaAudioDeviceModule.AudioSamples samples) {
        if (closed) return;
        final byte[] data = samples.getData().clone();
        final int rate = samples.getSampleRate();
        final int ch = samples.getChannelCount();
        handler.post(() -> encode(data, rate, ch));
    }

    // stop 은 EOS 를 밀어넣고 muxer 를 finalize 한 뒤 결과를 동기 반환한다.
    Result stop() {
        closed = true;
        final Result result = new Result();
        final CountDownLatch latch = new CountDownLatch(1);
        handler.post(() -> {
            try {
                if (codec != null) {
                    final int inIdx = codec.dequeueInputBuffer(CODEC_TIMEOUT_US);
                    if (inIdx >= 0) {
                        codec.queueInputBuffer(inIdx, 0, 0, presentationTimeUs(),
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                        drain(true);
                    }
                    codec.stop();
                    codec.release();
                }
                if (muxer != null && muxerStarted) {
                    muxer.stop();
                    muxer.release();
                }
                result.durationMs = sampleRate > 0 ? totalPcmFrames * 1000L / sampleRate : 0;
            } catch (Exception e) {
                Log.e(TAG, "stop failed", e);
            } finally {
                latch.countDown();
            }
        });
        try {
            if (!latch.await(STOP_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                Log.w(TAG, "stop timeout — 파일이 미완성일 수 있음");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        thread.quitSafely();
        result.sizeBytes = file.length();
        return result;
    }

    private void encode(final byte[] pcm, final int rate, final int ch) {
        if (codec == null && !initCodec(rate, ch)) return;
        try {
            final int inIdx = codec.dequeueInputBuffer(CODEC_TIMEOUT_US);
            if (inIdx >= 0) {
                final ByteBuffer input = codec.getInputBuffer(inIdx);
                input.clear();
                input.put(pcm);
                codec.queueInputBuffer(inIdx, 0, pcm.length, presentationTimeUs(), 0);
                totalPcmFrames += pcm.length / 2L / ch;
            }
            drain(false);
        } catch (Exception e) {
            Log.e(TAG, "encode failed", e);
        }
    }

    private boolean initCodec(final int rate, final int ch) {
        try {
            sampleRate = rate;
            channels = ch;
            final MediaFormat format = MediaFormat.createAudioFormat(
                    MediaFormat.MIMETYPE_AUDIO_AAC, rate, ch);
            format.setInteger(MediaFormat.KEY_AAC_PROFILE,
                    MediaCodecInfo.CodecProfileLevel.AACObjectLC);
            format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE);
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024);
            codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            codec.start();
            muxer = new MediaMuxer(file.getAbsolutePath(),
                    MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "codec init failed", e);
            codec = null;
            return false;
        }
    }

    private void drain(final boolean untilEos) {
        final MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        while (true) {
            final int outIdx = codec.dequeueOutputBuffer(info, untilEos ? CODEC_TIMEOUT_US : 0);
            if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                trackIndex = muxer.addTrack(codec.getOutputFormat());
                muxer.start();
                muxerStarted = true;
                continue;
            }
            if (outIdx < 0) {
                if (untilEos && outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) continue;
                return;
            }
            final ByteBuffer out = codec.getOutputBuffer(outIdx);
            if (info.size > 0 && muxerStarted
                    && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                muxer.writeSampleData(trackIndex, out, info);
            }
            codec.releaseOutputBuffer(outIdx, false);
            if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return;
        }
    }

    private long presentationTimeUs() {
        return sampleRate > 0 ? totalPcmFrames * 1_000_000L / sampleRate : 0;
    }

    static final class Result {
        long sizeBytes;
        long durationMs;
    }
}
