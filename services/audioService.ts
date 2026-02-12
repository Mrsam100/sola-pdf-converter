/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ========================================
// Audio to Text Service — 100% Client-Side
// Uses Web Speech API for live recording
// Uses @huggingface/transformers (Whisper) for file upload
// ========================================

/** Supported audio MIME types */
const SUPPORTED_AUDIO_TYPES = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
    'audio/ogg', 'audio/webm', 'audio/flac', 'audio/aac', 'audio/mp4',
    'audio/x-m4a', 'audio/m4a', 'audio/x-flac', 'audio/amr', 'audio/opus',
    'audio/x-aiff', 'audio/aiff',
];

/** Supported audio file extensions */
const SUPPORTED_EXTENSIONS = [
    '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.flac',
    '.aiff', '.alac', '.amr', '.opus', '.webm',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// ========================================
// Browser Support Detection
// ========================================

export interface BrowserSupport {
    speechRecognition: boolean;
    audioContext: boolean;
}

export function checkBrowserSupport(): BrowserSupport {
    return {
        speechRecognition: typeof window !== 'undefined' && (
            'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
        ),
        audioContext: typeof window !== 'undefined' && (
            'AudioContext' in window || 'webkitAudioContext' in window
        ),
    };
}

// ========================================
// File Validation
// ========================================

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateAudioFile(file: File): ValidationResult {
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 25MB.`,
        };
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.includes(ext);
    const hasValidType = file.type && SUPPORTED_AUDIO_TYPES.some(t => file.type.startsWith(t.split('/')[0]));

    if (!hasValidExt && !hasValidType) {
        return {
            valid: false,
            error: `Unsupported audio format. Supported: ${SUPPORTED_EXTENSIONS.map(e => e.slice(1).toUpperCase()).join(', ')}`,
        };
    }

    return { valid: true };
}

// ========================================
// Audio Decoding (for Whisper)
// ========================================

/**
 * Decodes an audio file to a Float32Array at 16kHz mono (Whisper requirement).
 * Uses AudioContext + OfflineAudioContext for resampling.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
        throw new Error('AudioContext is not supported in this browser.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioCtx();

    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
        await audioCtx.close();
        throw new Error('Could not decode audio file. Try converting to WAV format first.');
    }

    // Resample to 16kHz mono using OfflineAudioContext
    const targetSampleRate = 16000;
    const numSamples = Math.ceil(audioBuffer.duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, numSamples, targetSampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampledBuffer = await offlineCtx.startRendering();
    await audioCtx.close();

    return resampledBuffer.getChannelData(0);
}

// ========================================
// Whisper Transcription (File Upload)
// ========================================

type ProgressCallback = (progress: number, status: string) => void;

let pipelineInstance: any = null;

/**
 * Transcribes audio data using Whisper (tiny model via @huggingface/transformers).
 * Lazy-loads the model on first use; subsequent calls use the cached pipeline.
 *
 * 🔒 SECURITY FIX: Added timeout protection to prevent indefinite hanging
 */
export async function transcribeWithWhisper(
    audioData: Float32Array,
    onProgress?: ProgressCallback
): Promise<string> {
    const MODEL_LOAD_TIMEOUT = 180000; // 3 minutes for first-time model download
    const TRANSCRIPTION_TIMEOUT = 120000; // 2 minutes for transcription

    onProgress?.(5, 'Loading AI model...');

    // Lazy-load the transformers library
    const { pipeline } = await import('@huggingface/transformers');

    if (!pipelineInstance) {
        onProgress?.(10, 'Downloading Whisper model (first time only)...');

        // Timeout wrapper for model loading (first time only)
        pipelineInstance = await Promise.race([
            pipeline(
                'automatic-speech-recognition',
                'onnx-community/whisper-tiny.en',
                {
                    dtype: 'q8',
                    device: 'wasm',
                }
            ),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Model download timed out. Please check your internet connection and try again.')), MODEL_LOAD_TIMEOUT)
            )
        ]);

        onProgress?.(50, 'Model loaded! Transcribing...');
    } else {
        onProgress?.(50, 'Transcribing audio...');
    }

    // Timeout wrapper for transcription
    const result = await Promise.race([
        pipelineInstance(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: false,
        }),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Transcription timed out. The audio file may be too long or complex. Try splitting it into shorter segments.')), TRANSCRIPTION_TIMEOUT)
        )
    ]);

    onProgress?.(100, 'Transcription complete!');

    // Result can be a single object or an array
    if (Array.isArray(result)) {
        return result.map((r: any) => r.text).join(' ').trim();
    }
    return (result as any).text?.trim() || '';
}

// ========================================
// Web Speech API (Live Recording)
// ========================================

export interface SpeechRecognizerOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult: (transcript: string, isFinal: boolean) => void;
    onError: (error: string) => void;
    onEnd: () => void;
}

export interface SpeechRecognizerHandle {
    start: () => void;
    stop: () => void;
    abort: () => void;
}

/**
 * Creates a Web Speech API recognizer instance with event callbacks.
 * Returns a handle with start/stop/abort methods.
 */
export function createSpeechRecognizer(options: SpeechRecognizerOptions): SpeechRecognizerHandle {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
        throw new Error('Speech recognition is not supported in this browser.');
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.language || navigator.language || 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            options.onResult(finalTranscript.trim(), true);
        }
        if (interimTranscript) {
            options.onResult(interimTranscript, false);
        }
    };

    recognition.onerror = (event: any) => {
        let message: string;
        switch (event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
                message = 'Microphone access denied. Please allow microphone permission in your browser settings.';
                break;
            case 'no-speech':
                message = 'No speech detected. Please try speaking closer to the microphone.';
                break;
            case 'audio-capture':
                message = 'No microphone found. Please connect a microphone and try again.';
                break;
            case 'network':
                message = 'Network error. Speech recognition requires an internet connection.';
                break;
            case 'aborted':
                return; // User-initiated abort, no error
            default:
                message = `Speech recognition error: ${event.error}`;
        }
        options.onError(message);
    };

    recognition.onend = () => {
        options.onEnd();
    };

    return {
        start: () => recognition.start(),
        stop: () => recognition.stop(),
        abort: () => recognition.abort(),
    };
}
