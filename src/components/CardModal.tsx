import {useEffect, useRef} from "react";
import type {Card} from "../data/model.ts";
import {Modal} from "./Modal.tsx";
import CardForm from "./CardForm.tsx";
import {useEditorDraft} from "../data/useEditorDraft";

export type CardModalMode = 'create' | 'edit';

export interface CardModalProps {
    mode: CardModalMode;
    initial?: Card;
    open: boolean;
    deckId: string;
    onClose: () => void;
    onCreated?: (card: Card) => void;
    onUpdated?: (card: Card) => void;
}

export function CardModal({mode, initial, open, onClose, deckId, onCreated, onUpdated}: CardModalProps) {
    const draft = useEditorDraft("flashcard_card", mode === "edit" ? initial : undefined, deckId, open);
    const generation = useRef(0);
    useEffect(() => {const openedGeneration = ++generation.current; return () => {generation.current = openedGeneration + 1;};}, [open, deckId, initial?.id, mode]);
    const title = mode === 'create' ? 'Create Card' : 'Edit Card';
    const submitLabel = mode === 'create' ? 'Create Card' : 'Update Card';

    return (
        <Modal open={open} onClose={onClose} title={title}>
            {draft.error && <p role="alert">{draft.error}</p>}
            <CardForm
                values={{front: String(draft.fields.front ?? initial?.front ?? ""), back: String(draft.fields.back ?? initial?.back ?? "")}}
                onFieldChange={draft.write}
                initial={initial}
                submitLabel={submitLabel}
                onSubmit={async () => {
                    const openedGeneration = generation.current;
                    const card = await draft.commit() as Card;
                    if (generation.current !== openedGeneration) return;
                    if (mode === 'edit') onUpdated?.(card); else onCreated?.(card);
                    onClose();
                }}
            />
        </Modal>
    )
}
