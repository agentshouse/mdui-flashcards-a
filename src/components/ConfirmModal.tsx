import {Modal} from "./Modal";
import {SubmitButton} from "./SubmitButton";
import {useRef, useState} from "react";

export interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    submitLabel?: string;
    isSubmittingLabel?: string;
    onConfirm: () => Promise<void>;
}

export function ConfirmModal({open, onClose, title, message, submitLabel, isSubmittingLabel,
                                 onConfirm}: ConfirmModalProps) {
    const lock = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const doSubmit = async () => {
        if (lock.current) return;
        lock.current = true;
        setIsSubmitting(true); setError(null);
        try {
            await onConfirm();
        } catch (e) {setError(e instanceof Error ? e.message : String(e));} finally {
            lock.current = false; setIsSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={() => {if (!lock.current) onClose();}}
            title={title ?? 'Confirm action'}
        >
            <div>
                {error && <p role="alert" className="mb-4 text-red-800">{error}</p>}
                <span className="block pb-4 text-sm text-slate-900 dark:text-slate-100">
                    {message}
                </span>
            </div>
            <div className="flex justify-between pt-4">
                <div>
                    <button
                        type="button"
                        disabled={isSubmitting} onClick={() => onClose()}
                        className="text-sm, px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700">
                        Cancel
                    </button>
                </div>
                <div>
                    <SubmitButton isSubmitting={isSubmitting} text={submitLabel ?? 'Submit'}
                                  submittingText={isSubmittingLabel ?? 'Submitting...'} onClick={doSubmit}/>
                </div>

            </div>

        </Modal>)
}
