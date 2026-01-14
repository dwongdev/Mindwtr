import type { RefObject } from 'react';
import type { Attachment } from '@mindwtr/core';

type AudioAttachmentModalProps = {
    attachment: Attachment | null;
    audioSource: string | null;
    audioRef: RefObject<HTMLAudioElement>;
    audioError: string | null;
    onClose: () => void;
    onAudioError: () => void;
    onOpenExternally: () => void;
    t: (key: string) => string;
};

export function AudioAttachmentModal({
    attachment,
    audioSource,
    audioRef,
    audioError,
    onClose,
    onAudioError,
    onOpenExternally,
    t,
}: AudioAttachmentModalProps) {
    if (!attachment || !audioSource) return null;
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            role="button"
            tabIndex={0}
            aria-label={t('common.close')}
            onClick={onClose}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                if (event.currentTarget !== event.target) return;
                event.preventDefault();
                onClose();
            }}
        >
            <div
                className="w-full max-w-md bg-popover text-popover-foreground rounded-xl border shadow-2xl p-4 space-y-3"
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{attachment.title || t('quickAdd.audioNoteTitle')}</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        {t('common.close')}
                    </button>
                </div>
                <audio
                    ref={audioRef}
                    controls
                    src={audioSource}
                    className="w-full"
                    onError={onAudioError}
                />
                {audioError ? (
                    <div className="flex items-center justify-between text-xs text-red-500">
                        <span>{audioError}</span>
                        <button
                            type="button"
                            onClick={onOpenExternally}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {t('attachments.open')}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
