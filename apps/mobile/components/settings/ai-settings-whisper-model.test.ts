import { describe, expect, it } from 'vitest';

import {
    downloadWhisperModelFile,
    isWhisperModelFileReady,
    isWhisperModelSafeDeleteTarget,
    verifyWhisperModelFileHash,
    type WhisperModelDescriptor,
} from './ai-settings-whisper-model';

const minBytes = 50 * 1024 * 1024;
const sizeBytes = 77691713;
const sha256 = 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21';

const model: WhisperModelDescriptor = {
    id: 'whisper-tiny',
    fileName: 'ggml-tiny.bin',
    label: 'whisper-tiny',
    minBytes,
    sizeBytes,
    sha256,
};

describe('ai settings whisper model helpers', () => {
    it('requires a complete-looking model file before marking it ready', () => {
        expect(isWhisperModelFileReady(model, { exists: true, isDirectory: false, size: sizeBytes })).toBe(true);
        expect(isWhisperModelFileReady(model, { exists: true, isDirectory: false, size: sizeBytes - 1 })).toBe(false);
        expect(isWhisperModelFileReady(model, { exists: true, isDirectory: false, size: sizeBytes + 1 })).toBe(false);
        expect(isWhisperModelFileReady(model, { exists: true, isDirectory: true, size: sizeBytes })).toBe(false);
        expect(isWhisperModelFileReady(model, { exists: false, isDirectory: false, size: sizeBytes })).toBe(false);
    });

    it('only allows deletion of exact known model files', () => {
        const allowed = ['file:///document/whisper-models/ggml-tiny.bin'];

        expect(isWhisperModelSafeDeleteTarget({
            uri: 'file:///document/whisper-models/ggml-tiny.bin',
            fileName: model.fileName,
            allowedUris: allowed,
        })).toBe(true);
        expect(isWhisperModelSafeDeleteTarget({
            uri: 'file:///document/notes/ggml-tiny.bin',
            fileName: model.fileName,
            allowedUris: allowed,
        })).toBe(false);
        expect(isWhisperModelSafeDeleteTarget({
            uri: 'file:///document/whisper-models/other.bin',
            fileName: model.fileName,
            allowedUris: allowed,
        })).toBe(false);
    });

    it('rejects model files whose SHA-256 does not match the pinned digest', async () => {
        await expect(verifyWhisperModelFileHash(
            model,
            'file:///document/whisper-models/ggml-tiny.bin',
            async () => '0000000000000000000000000000000000000000000000000000000000000000'
        )).rejects.toThrow('Whisper model SHA-256 mismatch');

        await expect(verifyWhisperModelFileHash(
            model,
            'file:///document/whisper-models/ggml-tiny.bin',
            async () => sha256.toUpperCase()
        )).resolves.toBeUndefined();
    });

    it('prefers native streaming downloads for Whisper models', async () => {
        const calls: unknown[] = [];
        const targetFile = { uri: 'file:///document/whisper-models/ggml-tiny.bin' };
        const nativeFs = {
            downloadFile: (options: unknown) => {
                calls.push(options);
                return {
                    promise: Promise.resolve({ statusCode: 200, bytesWritten: sizeBytes }),
                };
            },
        };

        const result = await downloadWhisperModelFile({
            url: 'https://example.test/ggml-tiny.bin',
            targetFile,
            nativeFs,
            expoDownloadFile: async () => {
                throw new Error('Expo download should not be used when native streaming is available');
            },
        });

        expect(result).toBe(targetFile);
        expect(calls).toEqual([expect.objectContaining({
            fromUrl: 'https://example.test/ggml-tiny.bin',
            toFile: '/document/whisper-models/ggml-tiny.bin',
        })]);
    });

    it('rejects non-2xx native Whisper downloads before file-size validation', async () => {
        let deleted = false;

        await expect(downloadWhisperModelFile({
            url: 'https://example.test/ggml-tiny.bin',
            targetFile: {
                uri: 'file:///document/whisper-models/ggml-tiny.bin',
                delete: () => { deleted = true; },
            },
            nativeFs: {
                downloadFile: () => ({
                    promise: Promise.resolve({ statusCode: 302, bytesWritten: 1093 }),
                }),
            },
            expoDownloadFile: async () => {
                throw new Error('Expo download should not be used when native streaming is available');
            },
        })).rejects.toThrow('HTTP 302');
        expect(deleted).toBe(true);
    });

});
