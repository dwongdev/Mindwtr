import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystemMock = vi.hoisted(() => ({
  bytes: vi.fn(),
}));

const appLogMock = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const whisperMock = vi.hoisted(() => ({
  initWhisper: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('expo-file-system', () => ({
  Directory: class MockDirectory {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }
  },
  File: class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get name() {
      return this.uri.split('/').pop() ?? 'audio.wav';
    }

    get type() {
      return this.uri.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
    }

    get exists() {
      return true;
    }

    get size() {
      return 44;
    }

    bytes() {
      return fileSystemMock.bytes(this.uri);
    }
  },
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///document/' },
    info: vi.fn(() => ({ exists: true, isDirectory: false })),
  },
}));

vi.mock('./app-log', () => appLogMock);
vi.mock('whisper.rn/src/index', () => whisperMock);
vi.mock('whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter.js', () => ({}));
vi.mock('whisper.rn/realtime-transcription/index.js', () => ({}));

import { prepareAudioForLocalWhisper, processAudioCapture, startWhisperRealtimeCapture } from './speech-to-text';

const makePcmWav = ({
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16,
  dataBytes = 6400,
} = {}) => {
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      bytes[offset + i] = value.charCodeAt(i);
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  return bytes;
};

const makeM4aHeader = () => new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x4d, 0x34, 0x41, 0x20,
  0x00, 0x00, 0x00, 0x00,
]);

describe('speech-to-text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails cleanly when Android Whisper realtime helper modules are unavailable', async () => {
    await expect(
      startWhisperRealtimeCapture('/tmp/mindwtr-audio.wav', {
        provider: 'whisper',
        model: 'whisper-tiny',
        modelPath: '/tmp/ggml-tiny.en.bin',
      })
    ).rejects.toThrow('Whisper realtime transcription requires native audio stream modules.');
  });

  it('accepts 16 kHz mono PCM WAV input for local Whisper', async () => {
    fileSystemMock.bytes.mockResolvedValueOnce(makePcmWav());

    await expect(
      prepareAudioForLocalWhisper({
        uri: 'file:///tmp/audio.wav',
        platform: 'android',
        source: 'pcm-recorder',
        extension: '.wav',
      })
    ).resolves.toMatchObject({
      uri: 'file:///tmp/audio.wav',
      format: 'wav-pcm',
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      bytes: 6444,
      durationMs: 200,
    });
    expect(appLogMock.logInfo).toHaveBeenCalledWith(
      'ASR_INPUT_ACCEPTED_LOCAL_WHISPER',
      expect.objectContaining({
        extra: expect.objectContaining({
          local_whisper_called: 'false',
          sniffed_format: 'wav',
        }),
      })
    );
  });

  it('rejects compressed audio before local Whisper can run', async () => {
    fileSystemMock.bytes.mockResolvedValueOnce(makeM4aHeader());

    await expect(
      prepareAudioForLocalWhisper({
        uri: 'file:///tmp/audio.m4a',
        platform: 'android',
        source: 'expo-recorder',
        extension: '.m4a',
      })
    ).resolves.toBeNull();
    expect(appLogMock.logWarn).toHaveBeenCalledWith(
      'ASR_INPUT_REJECTED_UNSUPPORTED_FORMAT',
      expect.objectContaining({
        extra: expect.objectContaining({
          extension: '.m4a',
          local_whisper_called: 'false',
          reject_reason: 'too_short',
        }),
      })
    );
  });

  it('does not initialize local Whisper for m4a input', async () => {
    fileSystemMock.bytes.mockResolvedValueOnce(makeM4aHeader());

    await expect(
      processAudioCapture('file:///tmp/audio.m4a', {
        provider: 'whisper',
        model: 'whisper-tiny',
        modelPath: '/tmp/ggml-tiny.en.bin',
      })
    ).rejects.toThrow('Local Whisper can only transcribe 16 kHz mono PCM WAV audio.');
    expect(whisperMock.initWhisper).not.toHaveBeenCalled();
  });
});
