import { cn } from '../lib/utils';

type CloseBehaviorModalProps = {
    isOpen: boolean;
    title: string;
    description: string;
    rememberLabel: string;
    stayLabel: string;
    quitLabel: string;
    cancelLabel: string;
    remember: boolean;
    onRememberChange: (next: boolean) => void;
    onStay: () => void;
    onQuit: () => void;
    onCancel: () => void;
};

export function CloseBehaviorModal({
    isOpen,
    title,
    description,
    rememberLabel,
    stayLabel,
    quitLabel,
    cancelLabel,
    remember,
    onRememberChange,
    onStay,
    onQuit,
    onCancel,
}: CloseBehaviorModalProps) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{description}</p>
                </div>
                <div className="p-6">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => onRememberChange(e.target.checked)}
                            className="h-4 w-4 accent-primary"
                        />
                        {rememberLabel}
                    </label>
                </div>
                <div className="p-6 border-t border-border flex flex-wrap gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onStay}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
                    >
                        {stayLabel}
                    </button>
                    <button
                        onClick={onQuit}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                            "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        )}
                    >
                        {quitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
