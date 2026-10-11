import {useEffect, useRef} from "react";
import {useNavigate} from "react-router";
import {useEditorDraft} from "../data/useEditorDraft";
import CreateDeckForm from "./CreateDeckForm.tsx";



export function CreateDeckPage() {
    const navigate = useNavigate();
    const draft = useEditorDraft("flashcard_deck");
    const alive = useRef(true); useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);

    const createDeck = async () => {
        const createdDeck = await draft.commit();
        if (alive.current) navigate(`/decks/${createdDeck.id}`);
    };

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-black mb-2">Create New Deck</h1>
                <p className="text-[15px] text-black/50">Add a new deck to your collection</p>
            </div>
            {draft.error && <p role="alert">{draft.error}</p>}
            <CreateDeckForm onSubmit={createDeck} submitLabel="Create Deck" values={{name: String(draft.fields.name ?? "")}} onFieldChange={draft.write}/>
        </>
    )
}